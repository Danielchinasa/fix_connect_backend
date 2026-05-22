import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

const customer: import('../auth/types/jwt-payload.type').JwtPayload = {
  sub: 'user-customer',
  email: 'customer@test.com',
  role: Role.CUSTOMER,
};

const artisanUser: import('../auth/types/jwt-payload.type').JwtPayload = {
  sub: 'user-artisan',
  email: 'artisan@test.com',
  role: Role.ARTISAN,
};

const admin: import('../auth/types/jwt-payload.type').JwtPayload = {
  sub: 'user-admin',
  email: 'admin@test.com',
  role: Role.ADMIN,
};

const makeBooking = (overrides = {}) => ({
  id: 'booking-1',
  customerId: 'user-customer',
  artisanProfileId: 'profile-1',
  categoryId: 'cat-1',
  serviceDescription: 'Fix burst pipe',
  scheduledDate: new Date('2026-06-15'),
  timeSlot: '09:00 - 11:00',
  address: '5 Lagos Street',
  notes: null,
  totalAmount: 5000,
  status: BookingStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
  artisanProfile: {
    userId: 'user-artisan',
    user: { firstName: 'John', lastName: 'Doe', avatarUrl: null },
  },
  category: { id: 'cat-1', name: 'Plumbing', iconUrl: null },
  ...overrides,
});

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    artisanProfile: { findUnique: jest.Mock; update: jest.Mock };
    notification: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let emailService: { sendEmail: jest.Mock };
  let paymentsService: { releaseToArtisan: jest.Mock };

  beforeEach(() => {
    prisma = {
      booking: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      artisanProfile: { findUnique: jest.fn(), update: jest.fn() },
      notification: { create: jest.fn().mockResolvedValue({}) },
      // Simulate $transaction by running the callback with the prisma mock itself.
      // Returns a resolved Promise so the .then() chained in updateStatus works.
      $transaction: jest
        .fn()
        .mockImplementation((cb) => Promise.resolve(cb(prisma))),
    };
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    paymentsService = {
      releaseToArtisan: jest.fn().mockResolvedValue(undefined),
    };
    service = new BookingsService(
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
      paymentsService as unknown as PaymentsService,
    );
  });

  // ─── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      artisanProfileId: 'profile-1',
      categoryId: 'cat-1',
      serviceDescription: 'Fix burst pipe under the sink',
      scheduledDate: '2026-06-15',
      timeSlot: '09:00 - 11:00',
      address: '5 Lagos Street, Lekki',
      totalAmount: 5000,
    };

    it('creates and returns booking', async () => {
      // Artisan fetch now includes user for notification delivery
      prisma.artisanProfile.findUnique.mockResolvedValueOnce({
        id: 'profile-1',
        userId: 'user-artisan',
        user: {
          id: 'user-artisan',
          email: 'artisan@test.com',
          firstName: 'John',
        },
      });
      const booking = makeBooking();
      prisma.booking.create.mockResolvedValueOnce(booking);

      await expect(service.create('user-customer', dto)).resolves.toBe(booking);
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'user-customer' }),
        }),
      );
    });

    it('throws NotFoundException when artisan does not exist', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.create('user-customer', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── findAllForCustomer ──────────────────────────────────────────────────────
  describe('findAllForCustomer', () => {
    it('returns bookings for the given customer', () => {
      const bookings = [makeBooking()];
      prisma.booking.findMany.mockReturnValueOnce(bookings);
      expect(service.findAllForCustomer('user-customer')).toBe(bookings);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'user-customer' } }),
      );
    });
  });

  // ─── findAllForArtisan ───────────────────────────────────────────────────────
  describe('findAllForArtisan', () => {
    it('returns bookings for the given artisan profile', () => {
      const bookings = [makeBooking()];
      prisma.booking.findMany.mockReturnValueOnce(bookings);
      expect(service.findAllForArtisan('profile-1')).toBe(bookings);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns booking when customer is a party', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      await expect(
        service.findOne('booking-1', customer),
      ).resolves.toMatchObject({ id: 'booking-1' });
    });

    it('returns booking when artisan is a party', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      await expect(
        service.findOne('booking-1', artisanUser),
      ).resolves.toMatchObject({ id: 'booking-1' });
    });

    it('allows admin to access any booking', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      await expect(service.findOne('booking-1', admin)).resolves.toBeDefined();
    });

    it('throws ForbiddenException for unrelated user', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      const stranger = {
        sub: 'other-user',
        email: 'x@y.com',
        role: Role.CUSTOMER,
      };
      await expect(
        service.findOne('booking-1', stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('missing', customer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('customer can cancel a PENDING booking', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      const updated = makeBooking({ status: BookingStatus.CANCELLED });
      prisma.booking.update.mockResolvedValueOnce(updated);

      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CANCELLED },
          customer,
        ),
      ).resolves.toBe(updated);
    });

    it('artisan can confirm a PENDING booking', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      const updated = makeBooking({ status: BookingStatus.CONFIRMED });
      prisma.booking.update.mockResolvedValueOnce(updated);

      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CONFIRMED },
          artisanUser,
        ),
      ).resolves.toBe(updated);
    });

    it('customer cannot confirm a booking (wrong transition)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(makeBooking());
      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CONFIRMED },
          customer,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when booking is already terminal', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        makeBooking({ status: BookingStatus.COMPLETED }),
      );
      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CANCELLED },
          artisanUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateStatus(
          'missing',
          { status: BookingStatus.CANCELLED },
          customer,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('increments artisan completedJobs when marked COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        makeBooking({ status: BookingStatus.IN_PROGRESS }),
      );
      prisma.booking.update.mockResolvedValueOnce(
        makeBooking({ status: BookingStatus.COMPLETED }),
      );
      prisma.artisanProfile.update.mockResolvedValueOnce({});

      await service.updateStatus(
        'booking-1',
        { status: BookingStatus.COMPLETED },
        artisanUser,
      );

      expect(prisma.artisanProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { completedJobs: { increment: 1 } },
      });
    });
  });
});
