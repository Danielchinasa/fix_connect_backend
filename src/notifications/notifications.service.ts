import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get my notifications ─────────────────────────────────────────────────────
  // Returns all notifications for the authenticated user, ordered newest first.
  // The mobile app will display these in a list — no pagination yet, but we could
  // add `take` / `skip` later without changing the controller signature.
  findMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    });
  }

  // ─── Mark a single notification as read ───────────────────────────────────────
  // Two-step process:
  //   1. Fetch the notification so we can check ownership.
  //   2. Update it only if it belongs to the caller.
  //
  // Why not just `updateMany({ where: { id, userId } })`?
  // Because updateMany doesn't tell us whether 0 rows were updated because the
  // record didn't exist OR because the userId didn't match — we'd lose the ability
  // to return a clear 404 vs 403. The two-step approach gives precise errors.
  async markOneRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification '${notificationId}' not found`);
    }

    // Ownership check — prevent users from marking each other's notifications
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this notification',
      );
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  // ─── Mark all notifications as read ──────────────────────────────────────────
  // Uses `updateMany` — a single SQL UPDATE ... WHERE userId = ? AND isRead = false.
  // Much more efficient than fetching all records and updating them one by one.
  // We filter by `isRead: false` to avoid touching rows that are already read.
  //
  // Returns a count of how many rows were updated — the mobile app can use this
  // to clear its unread badge without needing a separate fetch.
  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: result.count };
  }
}
