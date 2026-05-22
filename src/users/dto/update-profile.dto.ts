import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

// ─── Why can't the user change email or phone here? ──────────────────────────
// Email and phone are identity fields used for login and OTP delivery.
// Changing them silently would be a security risk (account takeover).
// They require their own verified-change flow (send OTP to new address first).
// This DTO deliberately excludes those fields.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  bio?: string;

  // ISO 8601 date string — e.g. "1995-04-15"
  // Validated as a date string, converted to Date object in the service.
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  // Free text — e.g. "Male", "Female", "Non-binary"
  // We store as a plain string rather than an enum so the app can evolve
  // without a DB migration.
  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
