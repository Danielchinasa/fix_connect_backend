import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSavedAddressDto {
  // A short human-readable label the user picks, e.g. "Home", "Office"
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  // Optional — if true, this address becomes the user's default.
  // The service will unset all other defaults in a transaction.
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
