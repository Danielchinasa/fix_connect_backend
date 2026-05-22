import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SetCategoriesDto {
  // The full list of service category IDs this artisan offers.
  // Sending this REPLACES the previous list entirely (not additive).
  // Minimum 1 category — an artisan must offer at least one service.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];
}
