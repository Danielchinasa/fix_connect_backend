import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Raw SVG markup for the category icon.
  // Stored in the DB and returned inline with the category list so the
  // Flutter app never makes a separate network request just for an icon.
  @IsOptional()
  @IsString()
  iconSvg?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;
}
