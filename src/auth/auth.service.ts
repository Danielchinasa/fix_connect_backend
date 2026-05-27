import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { Role } from '@prisma/client';
import { OtpService } from './otp.service';
import { OTP_PURPOSE } from './types/otp-purpose.type';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as Role,
        passwordHash,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.replaceRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Block unverified users from obtaining tokens.
    // Automatically re-send an OTP so the mobile app can redirect
    // straight to the verification screen without an extra tap.
    if (!user.isVerified) {
      const code = await this.otpService.generateAndStore(
        user.id,
        OTP_PURPOSE.VERIFY_EMAIL,
      );
      await this.emailService.sendOtp(
        user.email,
        code,
        OTP_PURPOSE.VERIFY_EMAIL,
      );

      throw new UnauthorizedException(
        'Email not verified. A new code has been sent to your email address.',
      );
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.replaceRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const savedToken = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'desc' },
    });

    if (!savedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const matches = await bcrypt.compare(refreshToken, savedToken.token);
    if (!matches || savedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }

    const tokens = await this.generateTokens(
      payload.sub,
      payload.email,
      payload.role,
    );
    await this.replaceRefreshToken(payload.sub, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );

      await this.prisma.refreshToken.deleteMany({
        where: { userId: payload.sub },
      });
    } catch {
      // Keep logout idempotent and avoid leaking token validation details.
    }

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        artisanProfile: {
          select: {
            id: true,
            specialty: true,
            startingPrice: true,
            location: true,
            isVerified: true,
            isOnline: true,
            completedJobs: true,
            rating: true,
            responseTime: true,
            weeklySchedule: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toSafeUser(user);
  }

  // ─── OTP: send a verification or forgot-password code ──────────────────────
  async sendOtp(
    email: string,
    purpose: (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE],
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (purpose === OTP_PURPOSE.VERIFY_EMAIL) {
      if (!user) {
        throw new BadRequestException('No account found with this email');
      }
      if (user.isVerified) {
        throw new BadRequestException('This email is already verified');
      }
    }

    // For FORGOT_PASSWORD: return a generic response even when the email
    // is not registered to prevent user-enumeration attacks.
    if (!user) {
      return { message: 'If that email is registered, a code has been sent.' };
    }

    const code = await this.otpService.generateAndStore(user.id, purpose);
    await this.emailService.sendOtp(email, code, purpose);

    return { message: 'Verification code sent to your email address.' };
  }

  // ─── OTP: verify email address ─────────────────────────────────────────────
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const user = await this.otpService.requireUser(email);
    await this.otpService.verifyEmailOtp(user.id, code);
    return { message: 'Email verified successfully.' };
  }

  // ─── OTP: reset password ───────────────────────────────────────────────────
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.otpService.requireUser(email);
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await this.otpService.verifyAndResetPassword(
      user.id,
      code,
      newPasswordHash,
    );
    return { message: 'Password reset successfully. Please log in again.' };
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const accessExpiresInSeconds = Math.floor(
      this.durationToMs(accessExpiresIn) / 1000,
    );
    const refreshExpiresInSeconds = Math.floor(
      this.durationToMs(refreshExpiresIn) / 1000,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresInSeconds,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresInSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async replaceRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTtl =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const expiresAt = new Date(Date.now() + this.durationToMs(refreshTtl));

    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenHash,
        expiresAt,
      },
    });
  }

  private durationToMs(duration: string): number {
    const match = duration.match(/^(\d+)([mhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2];

    if (unit === 'm') {
      return value * 60 * 1000;
    }
    if (unit === 'h') {
      return value * 60 * 60 * 1000;
    }

    return value * 24 * 60 * 60 * 1000;
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role: Role;
    isVerified: boolean;
    isActive: boolean;
    bio?: string | null;
    dateOfBirth?: Date | null;
    gender?: string | null;
    city?: string | null;
    createdAt: Date;
    updatedAt: Date;
    artisanProfile?: {
      id: string;
      specialty: string;
      startingPrice: number;
      location: string;
      isVerified: boolean;
      isOnline: boolean;
      completedJobs: number;
      rating: number;
      responseTime: string | null;
      weeklySchedule: unknown;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      bio: user.bio ?? null,
      dateOfBirth: user.dateOfBirth ?? null,
      gender: user.gender ?? null,
      city: user.city ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      artisanProfile: user.artisanProfile ?? null,
    };
  }
}
