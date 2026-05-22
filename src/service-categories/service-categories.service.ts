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
  findAll() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Get a single active category by ID ─────────────────────────────────────
  async findOne(id: string) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id, isActive: true },
    });

    if (!category) {
      throw new NotFoundException(`Service category '${id}' not found`);
    }

    return category;
  }

  // ─── Create a new category (admin only) ─────────────────────────────────────
  // We check for duplicate names ourselves to return a clear 409 Conflict
  // rather than letting Prisma throw a raw unique-constraint error.
  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(
        `A category named '${dto.name}' already exists`,
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
