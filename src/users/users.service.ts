import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// ─── Safe user select ─────────────────────────────────────────────────────────
// We NEVER return passwordHash to the client. Prisma's `select` whitelist is
// safer than deleting the field after the fact — if a new sensitive field is
// added to the model, it won't leak until we explicitly add it here.
const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  isVerified: true,
  isActive: true,
  bio: true,
  dateOfBirth: true,
  gender: true,
  city: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: list all users ────────────────────────────────────────────────────
  async getUsers() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Self: update own profile ─────────────────────────────────────────────────
  // userId is taken from the verified JWT — the user can only update themselves.
  // `dateOfBirth` arrives as an ISO string from the DTO; we convert to Date here
  // so Prisma stores it as a proper timestamp, not a raw string.
  async updateMe(userId: string, dto: UpdateProfileDto) {
    // Destructure dateOfBirth so it doesn't appear twice in the data object.
    // Spreading dto first would give Prisma `dateOfBirth: string`, then our
    // explicit key would try to assign `Date` — TypeScript rejects the conflict.
    const { dateOfBirth, ...rest } = dto;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
      select: USER_SELECT,
    });
  }

  // ─── Self: update avatar URL ──────────────────────────────────────────────────
  // Called after the file has been saved to disk by the controller.
  // Separated from updateMe so the upload logic stays in the controller layer.
  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: USER_SELECT,
    });
  }

  // ─── Self: get profile stats ──────────────────────────────────────────────────
  // The mobile profile page shows: total bookings, total reviews written,
  // and (for artisans) their average rating and completed job count.
  //
  // We run all three DB queries in PARALLEL with Promise.all — running them
  // sequentially would take 3× as long. This is a key performance pattern.
  async getMyStats(userId: string, role: Role) {
    const [totalBookings, totalReviews, artisanProfile] = await Promise.all([
      // Count bookings where this user is the customer
      this.prisma.booking.count({ where: { customerId: userId } }),

      // Count reviews this user has written
      this.prisma.review.count({ where: { customerId: userId } }),

      // For artisans: fetch their cached rating and completed job count
      role === Role.ARTISAN
        ? this.prisma.artisanProfile.findUnique({
            where: { userId },
            select: { rating: true, completedJobs: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      totalBookings,
      totalReviews,
      // null for customers (they haven't received ratings)
      avgRating: artisanProfile?.rating ?? null,
      completedJobs: artisanProfile?.completedJobs ?? null,
    };
  }
}
