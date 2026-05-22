import { IsEmail, IsEnum } from 'class-validator';
import { OTP_PURPOSE } from '../types/otp-purpose.type';
import type { OtpPurpose } from '../types/otp-purpose.type';

export class SendOtpDto {
  @IsEmail()
  email!: string;

  @IsEnum(OTP_PURPOSE)
  purpose!: OtpPurpose;
}
