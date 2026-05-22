import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

// ─── Shared test fixture ──────────────────────────────────────────────────────
const makeNotification = (overrides = {}) => ({
  id: 'notif-1',
  userId: 'user-1',
  bookingId: null,
  type: 'BOOKING_CONFIRMED',
  title: 'Booking confirmed',
  body: 'Your booking has been confirmed.',
  isRead: false,
  sentAt: new Date(),
  ...overrides,
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    // Build a manual mock of only the Prisma methods we use.
    // This is faster than using Test.createTestingModule and avoids
    // any NestJS DI overhead in unit tests.
    prisma = {
      notification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findMine ────────────────────────────────────────────────────────────────
  describe('findMine', () => {
    it('queries notifications for the correct userId ordered by sentAt desc', () => {
      const notifications = [makeNotification()];
      prisma.notification.findMany.mockReturnValueOnce(notifications);

      // findMine returns the Prisma promise directly — no await needed here
      // because the mock returns synchronously and we just check the return value
      expect(service.findMine('user-1')).toBe(notifications);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { sentAt: 'desc' },
      });
    });
  });

  // ─── markOneRead ─────────────────────────────────────────────────────────────
  describe('markOneRead', () => {
    it('updates isRead to true and returns the notification', async () => {
      const notif = makeNotification();
      prisma.notification.findUnique.mockResolvedValueOnce(notif);
      const updated = { ...notif, isRead: true };
      prisma.notification.update.mockResolvedValueOnce(updated);

      await expect(service.markOneRead('user-1', 'notif-1')).resolves.toBe(
        updated,
      );

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
    });

    it('throws NotFoundException when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.markOneRead('user-1', 'bad-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when notification belongs to a different user', async () => {
      // Notification belongs to 'user-2', but 'user-1' is trying to read it
      prisma.notification.findUnique.mockResolvedValueOnce(
        makeNotification({ userId: 'user-2' }),
      );

      await expect(
        service.markOneRead('user-1', 'notif-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Should NOT attempt to update when ownership check fails
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  // ─── markAllRead ─────────────────────────────────────────────────────────────
  describe('markAllRead', () => {
    it('calls updateMany with correct filter and returns updated count', async () => {
      prisma.notification.updateMany.mockResolvedValueOnce({ count: 4 });

      await expect(service.markAllRead('user-1')).resolves.toEqual({
        updated: 4,
      });

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
    });

    it('returns { updated: 0 } when all notifications are already read', async () => {
      prisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.markAllRead('user-1')).resolves.toEqual({
        updated: 0,
      });
    });
  });
});
