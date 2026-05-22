import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 4, { message: 'code must be exactly 4 digits' })
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
