import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OTP_PURPOSE } from './types/otp-purpose.type';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeOtp = (
  overrides: Partial<{
    id: string;
    used: boolean;
    expiresAt: Date;
    code: string;
  }> = {},
) => ({
  id: 'otp-1',
  used: false,
  expiresAt: new Date(Date.now() + 600_000), // 10 min from now
  code: 'hashed',
  ...overrides,
});

describe('OtpService', () => {
  let service: OtpService;
  let prisma: jest.Mocked<{
    otp: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      deleteMany: jest.Mock;
    };
  }>;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      otp: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        deleteMany: jest.fn(),
      },
    };

    configService = { get: jest.fn().mockReturnValue(10) };

    service = new OtpService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  // ─── generateAndStore ────────────────────────────────────────────────────────
  describe('generateAndStore', () => {
    it('deletes previous OTPs for that user+purpose before creating a new one', async () => {
      prisma.otp.create.mockResolvedValueOnce({});

      await service.generateAndStore('user-1', OTP_PURPOSE.VERIFY_EMAIL);

      expect(prisma.otp.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', purpose: OTP_PURPOSE.VERIFY_EMAIL },
      });
      expect(prisma.otp.create).toHaveBeenCalledTimes(1);
    });

    it('returns a 4-character plaintext code', async () => {
      prisma.otp.create.mockResolvedValueOnce({});

      const code = await service.generateAndStore(
        'user-1',
        OTP_PURPOSE.VERIFY_EMAIL,
      );

      expect(code).toHaveLength(4);
      expect(/^\d{4}$/.test(code)).toBe(true);
    });

    it('stores a bcrypt hash — never the plaintext code', async () => {
      prisma.otp.create.mockResolvedValueOnce({});

      const code = await service.generateAndStore(
        'user-1',
        OTP_PURPOSE.VERIFY_EMAIL,
      );

      const stored = (prisma.otp.create.mock.calls[0][0] as any).data
        .code as string;
      expect(stored).not.toBe(code);
      await expect(bcrypt.compare(code, stored)).resolves.toBe(true);
    });
  });

  // ─── verify ──────────────────────────────────────────────────────────────────
  describe('verify', () => {
    it('throws BadRequestException when no OTP record is found', async () => {
      prisma.otp.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.verify('user-1', '1234', OTP_PURPOSE.VERIFY_EMAIL),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when OTP is expired', async () => {
      prisma.otp.findFirst.mockResolvedValueOnce(
        makeOtp({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.verify('user-1', '1234', OTP_PURPOSE.VERIFY_EMAIL),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when code is wrong', async () => {
      const hash = await bcrypt.hash('9999', 10);
      prisma.otp.findFirst.mockResolvedValueOnce(makeOtp({ code: hash }));

      await expect(
        service.verify('user-1', '1234', OTP_PURPOSE.VERIFY_EMAIL),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks OTP as used and resolves on valid code', async () => {
      const hash = await bcrypt.hash('1234', 10);
      prisma.otp.findFirst.mockResolvedValueOnce(makeOtp({ code: hash }));
      prisma.otp.update.mockResolvedValueOnce({});

      await expect(
        service.verify('user-1', '1234', OTP_PURPOSE.VERIFY_EMAIL),
      ).resolves.toBeUndefined();

      expect(prisma.otp.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { used: true },
      });
    });
  });

  // ─── verifyEmailOtp ───────────────────────────────────────────────────────────
  describe('verifyEmailOtp', () => {
    it('marks the user as verified after a successful OTP check', async () => {
      const hash = await bcrypt.hash('5678', 10);
      prisma.otp.findFirst.mockResolvedValueOnce(makeOtp({ code: hash }));
      prisma.otp.update.mockResolvedValueOnce({});
      prisma.user.update.mockResolvedValueOnce({});

      await service.verifyEmailOtp('user-1', '5678');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isVerified: true },
      });
    });
  });

  // ─── verifyAndResetPassword ───────────────────────────────────────────────────
  describe('verifyAndResetPassword', () => {
    it('updates password and deletes refresh tokens on success', async () => {
      const hash = await bcrypt.hash('4321', 10);
      prisma.otp.findFirst.mockResolvedValueOnce(makeOtp({ code: hash }));
      prisma.otp.update.mockResolvedValueOnce({});
      prisma.user.update.mockResolvedValueOnce({});
      prisma.refreshToken.deleteMany.mockResolvedValueOnce({ count: 2 });

      await service.verifyAndResetPassword('user-1', '4321', 'new-hash');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hash' },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  // ─── requireUser ─────────────────────────────────────────────────────────────
  describe('requireUser', () => {
    it('returns the user when found', async () => {
      const user = { id: 'u1', email: 'a@b.com' };
      prisma.user.findUnique.mockResolvedValueOnce(user);

      await expect(service.requireUser('a@b.com')).resolves.toEqual(user);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.requireUser('x@y.com')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
