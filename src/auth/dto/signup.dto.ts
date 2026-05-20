import { IsEmail, IsEnum, IsString, MinLength, Matches } from 'class-validator';

export enum SignupRole {
  CUSTOMER = 'CUSTOMER',
  ARTISAN = 'ARTISAN',
  ADMIN = 'ADMIN',
}

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(SignupRole)
  role!: SignupRole;
}
