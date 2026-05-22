// ─── Bank Accounts Controller Spec ───────────────────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('BankAccountsController', () => {
  let controller: BankAccountsController;
  let service: {
    create: jest.Mock;
    findMine: jest.Mock;
    remove: jest.Mock;
    verifyAccountNumber: jest.Mock;
  };

  const mockAccount = {
    id: 'ba-1',
    artisanProfileId: 'profile-1',
    bankName: 'Guaranty Trust Bank',
    bankCode: '058',
    accountNumber: '0123456789',
    accountName: 'JOHN DOE',
    paystackRecipientCode: 'RCP_stub',
    isVerified: true,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockAccount),
      findMine: jest.fn().mockResolvedValue(mockAccount),
      remove: jest.fn().mockResolvedValue(undefined),
      verifyAccountNumber: jest
        .fn()
        .mockResolvedValue({ accountName: 'JOHN DOE' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankAccountsController],
      providers: [{ provide: BankAccountsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BankAccountsController>(BankAccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('calls service.create and returns bank account', async () => {
      const dto = {
        bankName: 'GTBank',
        bankCode: '058',
        accountNumber: '0123456789',
      };
      const result = await controller.create('user-artisan', dto);
      expect(service.create).toHaveBeenCalledWith('user-artisan', dto);
      expect(result).toBe(mockAccount);
    });
  });

  describe('findMine', () => {
    it('calls service.findMine and returns account', async () => {
      const result = await controller.findMine('user-artisan');
      expect(service.findMine).toHaveBeenCalledWith('user-artisan');
      expect(result).toBe(mockAccount);
    });
  });

  describe('verify', () => {
    it('calls service.verifyAccountNumber with query params', async () => {
      const result = await controller.verify('0123456789', '058');
      expect(service.verifyAccountNumber).toHaveBeenCalledWith(
        '0123456789',
        '058',
      );
      expect(result).toEqual({ accountName: 'JOHN DOE' });
    });
  });

  describe('remove', () => {
    it('calls service.remove with user id and account id', async () => {
      await controller.remove('user-artisan', 'ba-1');
      expect(service.remove).toHaveBeenCalledWith('user-artisan', 'ba-1');
    });
  });
});
