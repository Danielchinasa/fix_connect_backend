import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeBooking = (overrides = {}) => ({
  id: 'booking-1',
  customerId: 'user-1',
  artisanProfileId: 'profile-1',
  status: BookingStatus.COMPLETED,
  ...overrides,
});

const makeReview = (overrides = {}) => ({
  id: 'review-1',
  bookingId: 'booking-1',
  customerId: 'user-1',
  artisanProfileId: 'profile-1',
  rating: 5,
  comment: 'Excellent work!',
  createdAt: new Date(),
  customer: { firstName: 'Jane', lastName: 'Doe', avatarUrl: null },
  ...overrides,
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    booking: { findUnique: jest.Mock };
    review: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      aggregate: jest.Mock;
    };
    artisanProfile: { update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      review: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      artisanProfile: { update: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    service = new ReviewsService(prisma as unknown as PrismaService);
  });

  // ─── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = { bookingId: 'booking-1', rating: 5, comment: 'Great work!' };

    beforeEach(() => {
      // Happy-path defaults — individual tests override as needed
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.review.findUnique.mockResolvedValue(null); // no existing review
      prisma.review.create.mockResolvedValue(makeReview());
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 5 } });
      prisma.artisanProfile.update.mockResolvedValue({});
    });

    it('creates review and updates artisan rating in a transaction', async () => {
      const result = await service.create('user-1', dto);
      expect(result).toMatchObject({ id: 'review-1', rating: 5 });

      // Verify the artisan rating was recalculated
      expect(prisma.artisanProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { rating: 5 },
      });
    });

    it('uses artisanProfileId from the booking, not from client input', async () => {
      await service.create('user-1', dto);

      // The review must be created with the artisanProfileId taken from
      // the booking row — the client has no say in this.
      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ artisanProfileId: 'profile-1' }),
        }),
      );
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(null);
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when customer does not own the booking', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        makeBooking({ customerId: 'someone-else' }),
      );
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when booking is not COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        makeBooking({ status: BookingStatus.CONFIRMED }),
      );
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ConflictException when review already exists', async () => {
      prisma.review.findUnique.mockResolvedValueOnce(makeReview());
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ─── findForArtisan ─────────────────────────────────────────────────────────
  describe('findForArtisan', () => {
    it('returns reviews ordered by date for the given artisan', () => {
      const reviews = [makeReview()];
      prisma.review.findMany.mockReturnValueOnce(reviews);

      expect(service.findForArtisan('profile-1')).toBe(reviews);
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { artisanProfileId: 'profile-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // ─── findMine ───────────────────────────────────────────────────────────────
  describe('findMine', () => {
    it('returns reviews written by the given customer', () => {
      const reviews = [makeReview()];
      prisma.review.findMany.mockReturnValueOnce(reviews);

      expect(service.findMine('user-1')).toBe(reviews);
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'user-1' } }),
      );
    });
  });
});
