// ─── Bank Accounts Service Spec ───────────────────────────────────────────────

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BankAccountsService } from './bank-accounts.service';

const makeBankAccount = (overrides = {}) => ({
  id: 'ba-1',
  artisanProfileId: 'profile-1',
  bankName: 'Guaranty Trust Bank',
  bankCode: '058',
  accountNumber: '0123456789',
  accountName: 'JOHN DOE',
  paystackRecipientCode: 'RCP_stub',
  isVerified: true,
  createdAt: new Date(),
  ...overrides,
});

describe('BankAccountsService', () => {
  let service: BankAccountsService;
  let prisma: any;
  let paystackGateway: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      artisanProfile: { findUnique: jest.fn() },
      artisanBankAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    paystackGateway = {
      verifyBankAccount: jest
        .fn()
        .mockResolvedValue({ accountName: 'JOHN DOE' }),
      createRecipient: jest
        .fn()
        .mockResolvedValue({ recipientCode: 'RCP_stub' }),
    };

    service = new BankAccountsService(
      prisma as unknown as PrismaService,
      paystackGateway,
    );
  });

  // ─── create ──────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      bankName: 'Guaranty Trust Bank',
      bankCode: '058',
      accountNumber: '0123456789',
    };

    it('registers a bank account for an artisan', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: Role.ARTISAN });
      prisma.artisanProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.artisanBankAccount.findUnique.mockResolvedValue(null);
      prisma.artisanBankAccount.create.mockResolvedValue(makeBankAccount());

      const result = await service.create('user-artisan', dto);

      expect(paystackGateway.verifyBankAccount).toHaveBeenCalledWith({
        accountNumber: '0123456789',
        bankCode: '058',
      });
      expect(paystackGateway.createRecipient).toHaveBeenCalled();
      expect(prisma.artisanBankAccount.create).toHaveBeenCalled();
      expect(result.accountName).toBe('JOHN DOE');
    });

    it('throws ForbiddenException for non-artisan users', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: Role.CUSTOMER });
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when artisan profile does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: Role.ARTISAN });
      prisma.artisanProfile.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when account already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: Role.ARTISAN });
      prisma.artisanProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.artisanBankAccount.findUnique.mockResolvedValue(makeBankAccount());
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ─── findMine ────────────────────────────────────────────────────────────────
  describe('findMine', () => {
    it('returns the bank account for the artisan', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      const account = makeBankAccount();
      prisma.artisanBankAccount.findUnique.mockResolvedValue(account);

      await expect(service.findMine('user-artisan')).resolves.toBe(account);
    });

    it('throws NotFoundException when no account registered', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.artisanBankAccount.findUnique.mockResolvedValue(null);
      await expect(service.findMine('user-artisan')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when artisan profile does not exist', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValue(null);
      await expect(service.findMine('user-artisan')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes the bank account for the owner', async () => {
      prisma.artisanBankAccount.findUnique.mockResolvedValue({
        ...makeBankAccount(),
        artisanProfile: { userId: 'user-artisan' },
      });
      prisma.artisanBankAccount.delete.mockResolvedValue({});

      await expect(
        service.remove('user-artisan', 'ba-1'),
      ).resolves.not.toThrow();
      expect(prisma.artisanBankAccount.delete).toHaveBeenCalledWith({
        where: { id: 'ba-1' },
      });
    });

    it('throws NotFoundException when account does not exist', async () => {
      prisma.artisanBankAccount.findUnique.mockResolvedValue(null);
      await expect(
        service.remove('user-artisan', 'bad-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user does not own the account', async () => {
      prisma.artisanBankAccount.findUnique.mockResolvedValue({
        ...makeBankAccount(),
        artisanProfile: { userId: 'other-user' },
      });
      await expect(
        service.remove('user-artisan', 'ba-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── verifyAccountNumber ─────────────────────────────────────────────────────
  describe('verifyAccountNumber', () => {
    it('delegates to paystackGateway.verifyBankAccount', async () => {
      const result = await service.verifyAccountNumber('0123456789', '058');
      expect(paystackGateway.verifyBankAccount).toHaveBeenCalledWith({
        accountNumber: '0123456789',
        bankCode: '058',
      });
      expect(result).toEqual({ accountName: 'JOHN DOE' });
    });
  });
});
