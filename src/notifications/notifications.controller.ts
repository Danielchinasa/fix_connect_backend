import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

// ─── Access control summary ───────────────────────────────────────────────────
//  GET   /notifications            → authenticated user — list own notifications
//  PATCH /notifications/read-all   → authenticated user — mark all as read
//  PATCH /notifications/:id/read   → authenticated user — mark one as read
//
// All routes require a valid JWT. There is no admin-only route here — admins
// can only see their own notifications, same as everyone else.
//
// IMPORTANT ROUTE ORDER:
//  "read-all" is a literal string and MUST come before "/:id/read".
//  If the parameterised route came first, NestJS would match "read-all" as
//  the :id value and the bulk-read endpoint would never be reached.
@Controller('notifications')
@UseGuards(JwtAuthGuard) // applies to every route in this controller
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── List my notifications ─────────────────────────────────────────────────
  // GET /notifications
  // Returns all notifications for the logged-in user, newest first.
  @Get()
  findMine(@CurrentUser('sub') userId: string) {
    return this.notificationsService.findMine(userId);
  }

  // ─── Mark ALL as read ──────────────────────────────────────────────────────
  // PATCH /notifications/read-all
  // Must be declared BEFORE /:id/read (see note above).
  // Returns { updated: number } so the Flutter app can clear its badge count.
  @Patch('read-all')
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  // ─── Mark ONE as read ──────────────────────────────────────────────────────
  // PATCH /notifications/:id/read
  // The service verifies ownership — a user cannot mark another user's
  // notification as read.
  @Patch(':id/read')
  markOneRead(
    @CurrentUser('sub') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markOneRead(userId, notificationId);
  }
}
