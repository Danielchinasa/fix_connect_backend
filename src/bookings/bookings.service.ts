import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, NotificationType, Role } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { PaymentsService } from '../payments/payments.service';
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
  // Logger lets us record notification failures without crashing the request
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─── Customer: create a booking ───────────────────────────────────────────────
  // The customer ID comes from the JWT — customers cannot book on behalf of others.
  // artisanProfileId and categoryId are validated by FK constraints in the DB.
  async create(customerId: string, dto: CreateBookingDto) {
    // Fetch the artisan and include their user account so we have their
    // email and name ready for notifications — one query instead of two.
    const artisan = await this.prisma.artisanProfile.findUnique({
      where: { id: dto.artisanProfileId },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
      },
    });
    if (!artisan) {
      throw new NotFoundException(
        `Artisan profile '${dto.artisanProfileId}' not found`,
      );
    }

    const booking = await this.prisma.booking.create({
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

    // ─── Fire notifications (best-effort) ──────────────────────────────────
    // We do NOT await this — the booking is already saved and the customer
    // gets their response immediately. If the notification or email fails
    // (e.g. email provider is down), we log the error but do not throw.
    // In a production system you would use a job queue (e.g. Bull) here
    // for guaranteed delivery and automatic retries.
    this.sendBookingNotifications(booking, artisan).catch((err: unknown) =>
      this.logger.error(
        'Failed to send booking notifications',
        err instanceof Error ? err.message : err,
      ),
    );

    return booking;
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
    return this.prisma
      .$transaction(async (tx) => {
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
      })
      .then((updated) => {
        // Fire-and-forget: release escrow funds to the artisan.
        // We do this AFTER the transaction commits so the booking status is
        // already COMPLETED when the gateway call is logged.
        // A gateway error here must never roll back the status change.
        if (dto.status === BookingStatus.COMPLETED) {
          this.paymentsService
            .releaseToArtisan(id)
            .catch((err: Error) =>
              this.logger.error(
                `Failed to release payment for booking ${id}: ${err.message}`,
              ),
            );
        }
        return updated;
      });
  }

  // ─── Private: send booking notifications ───────────────────────────────────
  // Creates an in-app notification record AND sends an email to the artisan.
  // Runs after the booking is persisted — called fire-and-forget from create().
  private async sendBookingNotifications(
    booking: {
      id: string;
      serviceDescription: string;
      scheduledDate: Date;
      timeSlot: string;
      address: string;
    },
    artisan: { userId: string; user: { email: string; firstName: string } },
  ): Promise<void> {
    const formattedDate = booking.scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. In-app notification — stored in DB, visible in the app's notification list
    await this.prisma.notification.create({
      data: {
        userId: artisan.userId,
        bookingId: booking.id,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'New booking request',
        body: `You have a new booking for "${booking.serviceDescription}" on ${formattedDate}.`,
      },
    });

    // 2. Email — sends to the artisan's registered email address
    await this.emailService.sendEmail({
      to: artisan.user.email,
      subject: 'FixConnect – New Booking Request',
      text: [
        `Hi ${artisan.user.firstName},`,
        '',
        'You have a new booking request on FixConnect.',
        '',
        `Service   : ${booking.serviceDescription}`,
        `Date      : ${formattedDate}`,
        `Time slot : ${booking.timeSlot}`,
        `Address   : ${booking.address}`,
        '',
        'Open the FixConnect app to confirm or decline.',
      ].join('\n'),
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
