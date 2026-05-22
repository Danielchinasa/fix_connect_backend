import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // iconUrl is an optional link to an icon image (SVG, PNG, etc.)
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;
}
