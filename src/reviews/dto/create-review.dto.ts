import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  // The booking this review is for.
  // We use bookingId (not artisanId) as the anchor because:
  //  1. Each booking can only have ONE review (enforced by @unique in Prisma)
  //  2. We look up the artisanProfileId from the booking server-side,
  //     so the client cannot spoof a different artisan.
  @IsString()
  bookingId!: string;

  // Integer star rating 1–5. Stored as Float in the DB so the computed
  // average on ArtisanProfile.rating can be a decimal (e.g. 4.7).
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  // Optional written comment. Minimum 5 chars to discourage empty strings.
  @IsOptional()
  @IsString()
  @MinLength(5)
  comment?: string;
}
