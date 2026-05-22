import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

// ─── Booking include shape ────────────────────────────────────────────────────
// Used consistently across all queries so every booking response
// carries the same related data.
const BOOKING_INCLUDE = {
  artisanProfile: {
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  category: { select: { id: true, name: true, iconUrl: true } },
} as const;

// ─── Status transition rules ──────────────────────────────────────────────────
// This map defines which statuses each role is ALLOWED to set.
// Keeping it as a plain object makes it easy to read, test, and extend.
const ALLOWED_TRANSITIONS: Record<Role, BookingStatus[]> = {
  [Role.CUSTOMER]: [BookingStatus.CANCELLED],
  [Role.ARTISAN]: [
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  [Role.ADMIN]: [BookingStatus.DISPUTED],
};

// ─── Statuses that are already terminal (no further changes allowed) ──────────
const TERMINAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.DISPUTED,
]);

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Customer: create a booking ───────────────────────────────────────────────
  // The customer ID comes from the JWT — customers cannot book on behalf of others.
  // artisanProfileId and categoryId are validated by FK constraints in the DB.
  async create(customerId: string, dto: CreateBookingDto) {
    // Verify artisan exists before creating
    const artisan = await this.prisma.artisanProfile.findUnique({
      where: { id: dto.artisanProfileId },
    });
    if (!artisan) {
      throw new NotFoundException(
        `Artisan profile '${dto.artisanProfileId}' not found`,
      );
    }

    return this.prisma.booking.create({
      data: {
        customerId,
        artisanProfileId: dto.artisanProfileId,
        categoryId: dto.categoryId,
        serviceDescription: dto.serviceDescription,
        scheduledDate: new Date(dto.scheduledDate),
        timeSlot: dto.timeSlot,
        address: dto.address,
        notes: dto.notes,
        totalAmount: dto.totalAmount,
      },
      include: BOOKING_INCLUDE,
    });
  }

  // ─── Customer: list own bookings ──────────────────────────────────────────────
  findAllForCustomer(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Artisan: list bookings by artisanProfileId ───────────────────────────────
  findAllForArtisan(artisanProfileId: string) {
    return this.prisma.booking.findMany({
      where: { artisanProfileId },
      include: BOOKING_INCLUDE,
      orderBy: { scheduledDate: 'asc' },
    });
  }

  // ─── Artisan: list bookings by userId (for controller use) ───────────────────
  // The JWT carries userId, not artisanProfileId. This resolves the profile
  // first so the controller stays unaware of that mapping.
  async findAllForArtisanByUserId(userId: string) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile)
      throw new NotFoundException('You do not have an artisan profile');
    return this.findAllForArtisan(profile.id);
  }

  // ─── Shared: get a single booking ────────────────────────────────────────────
  // After fetching, we verify the caller is actually a party to this booking.
  async findOne(id: string, caller: JwtPayload) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        ...BOOKING_INCLUDE,
        artisanProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException(`Booking '${id}' not found`);

    this.assertAccess(booking, caller);
    return booking;
  }

  // ─── Shared: update booking status ───────────────────────────────────────────
  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    caller: JwtPayload,
  ) {
    // Include artisanProfile so assertAccess can check artisan ownership.
    // We only select userId here — we don't need the full profile for a
    // permission check (BOOKING_INCLUDE is reserved for the final response).
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { artisanProfile: { select: { userId: true } } },
    });
    if (!booking) throw new NotFoundException(`Booking '${id}' not found`);

    this.assertAccess(booking, caller);

    // Block changes to already-finished bookings
    if (TERMINAL_STATUSES.has(booking.status)) {
      throw new ForbiddenException(
        `Booking is already ${booking.status} and cannot be changed`,
      );
    }

    // Enforce role-based transition rules
    const allowed = ALLOWED_TRANSITIONS[caller.role];
    if (!allowed.includes(dto.status)) {
      throw new ForbiddenException(
        `Your role cannot set a booking to ${dto.status}`,
      );
    }

    // ─── Atomic status update ────────────────────────────────────────────────
    // We use $transaction so the booking update and the artisan counter increment
    // either both succeed or both fail. Without a transaction, a server crash
    // between the two writes would leave the data inconsistent.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { status: dto.status },
        include: BOOKING_INCLUDE,
      });

      // When the artisan marks the job COMPLETED, increment their completed-jobs
      // counter. This keeps the profile stat current without a separate query.
      if (dto.status === BookingStatus.COMPLETED) {
        await tx.artisanProfile.update({
          where: { id: booking.artisanProfileId },
          data: { completedJobs: { increment: 1 } },
        });
      }

      return updated;
    });
  }

  // ─── Private: ownership check ────────────────────────────────────────────────
  // Admins can access any booking. Customers and artisans can only access
  // bookings they are a party to.
  private assertAccess(
    booking: { customerId: string; artisanProfile: { userId: string } },
    caller: JwtPayload,
  ) {
    if (caller.role === Role.ADMIN) return;

    const isCustomer = booking.customerId === caller.sub;
    const isArtisan = booking.artisanProfile.userId === caller.sub;

    if (!isCustomer && !isArtisan) {
      throw new ForbiddenException('You do not have access to this booking');
    }
  }
}
