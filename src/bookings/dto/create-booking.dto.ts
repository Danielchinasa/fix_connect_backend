import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBookingDto {
  // The artisan's profile ID (not user ID) — what the customer is booking
  @IsString()
  artisanProfileId!: string;

  // Service category being booked (e.g. "Plumbing")
  @IsString()
  categoryId!: string;

  // Free-text description of the job (e.g. "Fix a burst pipe under the kitchen sink")
  @IsString()
  @MinLength(10)
  serviceDescription!: string;

  // ISO 8601 date string — e.g. "2026-06-15"
  @IsDateString()
  scheduledDate!: string;

  // Human-readable time slot — e.g. "09:00 - 11:00"
  @IsString()
  timeSlot!: string;

  // Full address where the work will be done
  @IsString()
  @MinLength(5)
  address!: string;

  // Any extra instructions for the artisan
  @IsOptional()
  @IsString()
  notes?: string;

  // Total quoted price the customer has agreed to
  @IsNumber()
  @Min(0)
  totalAmount!: number;
}
