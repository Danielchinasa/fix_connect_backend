import { IsEmail } from 'class-validator';

// The forgot-password page only collects an email address.
// The backend sends a FORGOT_PASSWORD OTP then returns a generic
// message so we never reveal whether the email is registered.
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
