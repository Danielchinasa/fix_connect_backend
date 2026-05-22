import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  // 4-digit code to match the mobile app's OTP field length
  @IsString()
  @Length(4, 4, { message: 'code must be exactly 4 digits' })
  code!: string;
}
