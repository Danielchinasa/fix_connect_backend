import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// All fields are optional — PATCH only updates what you send.
export class UpdateArtisanProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  bio?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  specialty?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startingPrice?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  location?: string;

  @IsOptional()
  @IsString()
  responseTime?: string;

  // Artisans can toggle their online/available status from the app
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
