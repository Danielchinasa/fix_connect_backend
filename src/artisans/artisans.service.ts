import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArtisanProfileDto } from './dto/create-artisan-profile.dto';
import { SetCategoriesDto } from './dto/set-categories.dto';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';

// ─── Shared include shapes ────────────────────────────────────────────────────
// Defining these once avoids repeating the same nested object in every query.

const LIST_INCLUDE = {
  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
  categories: {
    include: {
      category: { select: { id: true, name: true, iconUrl: true } },
    },
  },
} as const;

const DETAIL_INCLUDE = {
  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
  categories: { include: { category: true } },
  workSamples: true,
} as const;

@Injectable()
export class ArtisansService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public: list all artisans ───────────────────────────────────────────────
  // Optional ?categoryId query param narrows results to artisans offering
  // that service category (the "Plumbing" tile → show plumbers pattern).
  findAll(categoryId?: string) {
    return this.prisma.artisanProfile.findMany({
      where: {
        user: { isActive: true },
        ...(categoryId ? { categories: { some: { categoryId } } } : {}),
      },
      include: LIST_INCLUDE,
      orderBy: { rating: 'desc' },
    });
  }

  // ─── Public: single artisan detail ──────────────────────────────────────────
  async findOne(id: string) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!profile || !profile.user) {
      throw new NotFoundException(`Artisan profile '${id}' not found`);
    }

    return profile;
  }

  // ─── Artisan: get own profile ────────────────────────────────────────────────
  async findMyProfile(userId: string) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId },
      include: DETAIL_INCLUDE,
    });

    if (!profile) {
      throw new NotFoundException('You do not have an artisan profile yet');
    }

    return profile;
  }

  // ─── Artisan: create profile ─────────────────────────────────────────────────
  // userId comes from the verified JWT — the artisan cannot create a profile
  // for someone else. userId is @unique on ArtisanProfile, so a second POST
  // returns 409 rather than a raw DB crash.
  async create(userId: string, dto: CreateArtisanProfileDto) {
    const existing = await this.prisma.artisanProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('You already have an artisan profile');
    }

    return this.prisma.artisanProfile.create({
      data: { ...dto, userId },
      include: DETAIL_INCLUDE,
    });
  }

  // ─── Artisan: update own profile ─────────────────────────────────────────────
  async update(userId: string, dto: UpdateArtisanProfileDto) {
    await this.findMyProfile(userId); // throws 404 if no profile yet

    return this.prisma.artisanProfile.update({
      where: { userId },
      data: dto,
      include: DETAIL_INCLUDE,
    });
  }

  // ─── Artisan: replace service categories ─────────────────────────────────────
  // This is a full replacement, not an append. Sending [A, B] when you had
  // [A, C] results in [A, B]. This is simpler for the mobile app — it just
  // sends the complete desired list from the multi-select screen.
  //
  // We validate the IDs first so the artisan gets a clear 400 error instead
  // of a cryptic foreign-key constraint failure from the database.
  async setCategories(userId: string, dto: SetCategoriesDto): Promise<void> {
    const profile = await this.findMyProfile(userId);

    const validCategories = await this.prisma.serviceCategory.findMany({
      where: { id: { in: dto.categoryIds }, isActive: true },
      select: { id: true },
    });

    if (validCategories.length !== dto.categoryIds.length) {
      throw new BadRequestException(
        'One or more category IDs are invalid or inactive',
      );
    }

    // $transaction ensures deleteMany + createMany are atomic:
    // if createMany fails, deleteMany is rolled back — no data loss.
    await this.prisma.$transaction(async (tx) => {
      await tx.artisanCategory.deleteMany({
        where: { artisanProfileId: profile.id },
      });
      await tx.artisanCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({
          artisanProfileId: profile.id,
          categoryId,
        })),
      });
    });
  }
}
