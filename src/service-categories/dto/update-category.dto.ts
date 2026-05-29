import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

// All fields are optional so PATCH can update just one field at a time.
// This is the standard REST PATCH pattern — only send what you want to change.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  iconSvg?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  // Admins can re-activate a previously deactivated category via PATCH
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
