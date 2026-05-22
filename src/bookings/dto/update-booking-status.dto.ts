import { BookingStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

// ─── Why is UpdateBookingDto just a status change? ────────────────────────────
// Bookings are not freely editable after creation — the address, date, amount,
// and artisan are locked in when the customer submits. What changes is the
// lifecycle STATUS. Each actor can only move the booking to certain statuses:
//
//   Customer  → CANCELLED (before CONFIRMED)
//   Artisan   → CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
//   Admin     → DISPUTED
//
// These business rules live in the service, not in this DTO.
export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
