import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_PURPOSE, OtpPurpose } from './types/otp-purpose.type';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Generate, store and return a plaintext OTP code ─────────────────────────
  // Security decisions:
  //  1. The code is generated with crypto.randomInt — cryptographically secure RNG.
  //  2. Only the bcrypt hash is stored; plaintext is returned once to be emailed.
  //  3. Any previous unused OTPs for the same user+purpose are deleted first
  //     to prevent accumulation and ensure only one valid code exists at a time.
  async generateAndStore(userId: string, purpose: OtpPurpose): Promise<string> {
    const expiryMinutes =
      this.configService.get<number>('OTP_EXPIRY_MINUTES') ?? 10;

    // Delete stale OTPs before creating a new one
    await this.prisma.otp.deleteMany({ where: { userId, purpose } });

    // Pad to 4 digits so '7' becomes '0007' — matches the mobile app's 4-field input
    const code = crypto.randomInt(0, 10000).toString().padStart(4, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.prisma.otp.create({
      data: { userId, code: codeHash, purpose, expiresAt },
    });

    return code; // Only returned here — never stored in plaintext
  }

  // ─── Verify a submitted code for a given purpose ──────────────────────────────
  // Returns void on success; throws on any failure.
  // Callers do NOT need to check the return value — an exception means failure.
  async verify(
    userId: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otp = await this.prisma.otp.findFirst({
      where: { userId, purpose, used: false },
      orderBy: { createdAt: 'desc' },
    });

    // Single generic error message prevents user enumeration
    if (!otp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired');
    }

    const matches = await bcrypt.compare(code, otp.code);
    if (!matches) {
      throw new BadRequestException('Invalid verification code');
    }

    // Mark as used immediately to prevent replay attacks
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });
  }

  // ─── Verify a code then mark the user's email as verified ─────────────────────
  async verifyEmailOtp(userId: string, code: string): Promise<void> {
    await this.verify(userId, code, OTP_PURPOSE.VERIFY_EMAIL);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });
  }

  // ─── Verify a code then update the user's password ────────────────────────────
  // Also deletes all active refresh tokens so stolen sessions are invalidated.
  async verifyAndResetPassword(
    userId: string,
    code: string,
    newPasswordHash: string,
  ): Promise<void> {
    await this.verify(userId, code, OTP_PURPOSE.FORGOT_PASSWORD);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate every active session after a password reset
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  // ─── Look up a user and throw a safe error if missing ─────────────────────────
  // Kept internal so AuthService can use it without duplicating the lookup.
  async requireUser(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Use UnauthorizedException to avoid leaking whether an email is registered
      throw new UnauthorizedException('Invalid request');
    }
    return user;
  }
}
