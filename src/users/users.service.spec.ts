import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@test.com',
  firstName: 'Jane',
  lastName: 'Doe',
  role: Role.CUSTOMER,
  isVerified: true,
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { findMany: jest.Mock; update: jest.Mock };
    booking: { count: jest.Mock };
    review: { count: jest.Mock };
    artisanProfile: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), update: jest.fn() },
      booking: { count: jest.fn() },
      review: { count: jest.fn() },
      artisanProfile: { findUnique: jest.fn() },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getUsers ───────────────────────────────────────────────────────────────
  describe('getUsers', () => {
    it('returns user list ordered by createdAt', async () => {
      const users = [makeUser()];
      prisma.user.findMany.mockResolvedValueOnce(users);
      expect(await service.getUsers()).toBe(users);
    });
  });

  // ─── updateMe ───────────────────────────────────────────────────────────────
  describe('updateMe', () => {
    it('updates and returns the user without passwordHash', async () => {
      const updated = makeUser({ firstName: 'Updated' });
      prisma.user.update.mockResolvedValueOnce(updated);

      await expect(
        service.updateMe('user-1', { firstName: 'Updated' }),
      ).resolves.toBe(updated);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });

    it('converts dateOfBirth string to Date object', async () => {
      prisma.user.update.mockResolvedValueOnce(makeUser());
      await service.updateMe('user-1', { dateOfBirth: '1995-04-15' });

      const callArg = prisma.user.update.mock.calls[0][0];
      expect(callArg.data.dateOfBirth).toBeInstanceOf(Date);
    });
  });

  // ─── updateAvatar ────────────────────────────────────────────────────────────
  describe('updateAvatar', () => {
    it('updates avatarUrl and returns user', async () => {
      const updated = makeUser({ avatarUrl: '/uploads/avatars/test.jpg' });
      prisma.user.update.mockResolvedValueOnce(updated);

      await expect(
        service.updateAvatar('user-1', '/uploads/avatars/test.jpg'),
      ).resolves.toBe(updated);
    });
  });

  // ─── getMyStats ──────────────────────────────────────────────────────────────
  describe('getMyStats', () => {
    it('returns customer stats with null avgRating', async () => {
      prisma.booking.count.mockResolvedValueOnce(5);
      prisma.review.count.mockResolvedValueOnce(3);

      const result = await service.getMyStats('user-1', Role.CUSTOMER);

      expect(result).toEqual({
        totalBookings: 5,
        totalReviews: 3,
        avgRating: null,
        completedJobs: null,
      });
      // Artisan profile should NOT be queried for a customer
      expect(prisma.artisanProfile.findUnique).not.toHaveBeenCalled();
    });

    it('returns artisan stats including avgRating and completedJobs', async () => {
      prisma.booking.count.mockResolvedValueOnce(12);
      prisma.review.count.mockResolvedValueOnce(7);
      prisma.artisanProfile.findUnique.mockResolvedValueOnce({
        rating: 4.8,
        completedJobs: 32,
      });

      const result = await service.getMyStats('user-1', Role.ARTISAN);

      expect(result).toEqual({
        totalBookings: 12,
        totalReviews: 7,
        avgRating: 4.8,
        completedJobs: 32,
      });
    });
  });
});
