import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateArtisanProfileDto {
  // A short personal bio shown on the artisan's public profile card
  @IsOptional()
  @IsString()
  @MinLength(10)
  bio?: string;

  // The artisan's primary trade (e.g. "Plumber", "Electrician")
  @IsString()
  @MinLength(2)
  specialty!: string;

  // Lowest price the artisan charges — displayed as "From ₦X" on the home screen
  @IsNumber()
  @Min(0)
  startingPrice!: number;

  // City or area the artisan serves (e.g. "Lagos, Lekki")
  @IsString()
  @MinLength(2)
  location!: string;

  // Human-readable response time (e.g. "Within 1 hour")
  @IsOptional()
  @IsString()
  responseTime?: string;
}
