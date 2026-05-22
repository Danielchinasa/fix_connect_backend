import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedAddressDto } from './create-saved-address.dto';

// PartialType makes every field from CreateSavedAddressDto optional,
// inheriting all the same class-validator decorators. This is the standard
// NestJS pattern for update DTOs — no duplication.
export class UpdateSavedAddressDto extends PartialType(CreateSavedAddressDto) {}
