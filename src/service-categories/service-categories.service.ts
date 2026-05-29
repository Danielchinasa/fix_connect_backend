import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// ─── Why separate the service from the controller? ────────────────────────────
// The controller only handles HTTP concerns (routing, status codes, validation).
// The service holds all business logic and database access.
// This separation means you can unit-test business logic without starting HTTP.
@Injectable()
export class ServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List all active categories ─────────────────────────────────────────────
  // Public — no authentication required.
  // Returns categories ordered alphabetically so the mobile home screen is stable.
  async findAll() {
    const categories = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { artisans: true } } },
    });
    return categories.map(({ _count, ...cat }) => ({
      ...cat,
      artisanCount: _count.artisans,
    }));
  }

  // ─── Get a single active category by ID ─────────────────────────────────────
  async findOne(id: string) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id, isActive: true },
      include: { _count: { select: { artisans: true } } },
    });

    if (!category) {
      throw new NotFoundException(`Service category '${id}' not found`);
    }

    const { _count, ...rest } = category;
    return { ...rest, artisanCount: _count.artisans };
  }

  // ─── Create a new category (admin only) ─────────────────────────────────────
  // We check for duplicate names ourselves to return a clear 409 Conflict
  // rather than letting Prisma throw a raw unique-constraint error.
  async create(dto: CreateCategoryDto) {
    // Case-insensitive check so "Plumbing" and "plumbing" are treated the same.
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });

    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException(
          `A category named '${existing.name}' already exists but is inactive. Use PATCH /${existing.id} with { "isActive": true } to restore it.`,
        );
      }
      throw new ConflictException(
        `A category named '${existing.name}' already exists`,
      );
    }

    return this.prisma.serviceCategory.create({ data: dto });
  }

  // ─── Update a category (admin only) ─────────────────────────────────────────
  async update(id: string, dto: UpdateCategoryDto) {
    // Ensure the category exists before trying to update
    await this.findOne(id);

    return this.prisma.serviceCategory.update({
      where: { id },
      data: dto,
    });
  }

  // ─── Soft-delete a category (admin only) ────────────────────────────────────
  // We use a soft-delete (isActive = false) instead of deleting the row.
  // This preserves foreign-key integrity — existing bookings that reference
  // this category remain valid in the database.
  async remove(id: string) {
    await this.findOne(id); // throws 404 if already gone

    await this.prisma.serviceCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
