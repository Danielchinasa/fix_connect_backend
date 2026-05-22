import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

// ─── What fields to return with every review ─────────────────────────────────
// We always embed the reviewer's name so the mobile UI can display
// "John D. — ★★★★☆" without a second API call.
const REVIEW_INCLUDE = {
  customer: {
    select: { firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Customer: submit a review ───────────────────────────────────────────────
  // The customer ID comes from the verified JWT — no spoofing possible.
  // We enforce four business rules before writing anything to the DB:
  //   1. The booking must exist.
  //   2. The caller must own the booking.
  //   3. The booking must be COMPLETED (you can't review work that hasn't finished).
  //   4. No review already exists for this booking (one review per booking).
  async create(customerId: string, dto: CreateReviewDto) {
    // ── Rule 1: booking must exist ──────────────────────────────────────────
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found`);
    }

    // ── Rule 2: caller must own the booking ─────────────────────────────────
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    // ── Rule 3: booking must be COMPLETED ───────────────────────────────────
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'You can only leave a review after the job is completed',
      );
    }

    // ── Rule 4: no duplicate review ─────────────────────────────────────────
    // bookingId is @unique in the Review model, so a second insert would throw
    // a raw DB error. We catch this here for a clean 409 response instead.
    const existing = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this booking');
    }

    // ── Atomic write: create review + refresh artisan's cached rating ────────
    // Why a transaction? If the review insert succeeds but the rating update
    // fails (e.g. DB timeout), the artisan's displayed rating would be stale.
    // The transaction rolls both back together on failure.
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the review row
      const review = await tx.review.create({
        data: {
          bookingId: dto.bookingId,
          customerId,
          artisanProfileId: booking.artisanProfileId, // from booking, not client
          rating: dto.rating,
          comment: dto.comment,
        },
        include: REVIEW_INCLUDE,
      });

      // 2. Recompute the artisan's average rating from ALL their reviews.
      //    Using _avg is more accurate than (oldAvg * n + newRating) / (n+1)
      //    because it's resilient to future review deletions or edits.
      const { _avg } = await tx.review.aggregate({
        where: { artisanProfileId: booking.artisanProfileId },
        _avg: { rating: true },
      });

      // 3. Persist the new average back to the artisan profile.
      //    The mobile home screen reads this cached value so listing queries
      //    stay fast (no sub-query per artisan needed).
      await tx.artisanProfile.update({
        where: { id: booking.artisanProfileId },
        data: { rating: _avg.rating ?? 0 },
      });

      return review;
    });
  }

  // ─── Public: list reviews for an artisan ─────────────────────────────────────
  // No authentication needed — visible on the artisan's public profile page.
  // Ordered newest-first so recent feedback is prominent.
  findForArtisan(artisanProfileId: string) {
    return this.prisma.review.findMany({
      where: { artisanProfileId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Customer: list their own reviews ────────────────────────────────────────
  // Used on the "My Reviews" section of the customer's profile page.
  findMine(customerId: string) {
    return this.prisma.review.findMany({
      where: { customerId },
      include: {
        ...REVIEW_INCLUDE,
        // Also embed artisan info so the customer can see "You reviewed John D."
        artisanProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
