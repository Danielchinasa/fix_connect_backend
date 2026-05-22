// ─── Bank Accounts Service ────────────────────────────────────────────────────
// Manages payout bank accounts for artisans.
//
// Flow when an artisan registers a bank account:
//   1. Verify the account number is real (Paystack /bank/resolve)
//   2. Create a Transfer Recipient in Paystack (saves the recipient code)
//   3. Store everything in ArtisanBankAccount
//
// The recipient code is then used every time we disburse a payout via
// PaymentsService.releaseToArtisan().
//
// Each artisan is limited to ONE bank account (enforced by the @unique
// constraint on artisanProfileId in the schema).

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PAYSTACK_GATEWAY } from '../payments/gateways/payment-gateway.interface';
import type { PaymentGatewayInterface } from '../payments/gateways/payment-gateway.interface';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';

@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYSTACK_GATEWAY)
    private readonly paystackGateway: PaymentGatewayInterface,
  ) {}

  /**
   * Register a bank account for the currently authenticated artisan.
   * Verifies the account with Paystack and creates a transfer recipient.
   * Throws ConflictException if the artisan already has an account registered.
   */
  async create(userId: string, dto: CreateBankAccountDto) {
    // ── 1. Confirm user is an ARTISAN ────────────────────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ARTISAN) {
      throw new ForbiddenException('Only artisans can register bank accounts');
    }

    // ── 2. Find the artisan profile ──────────────────────────────────────────
    const artisanProfile = await this.prisma.artisanProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!artisanProfile) {
      throw new NotFoundException(
        'Artisan profile not found. Please create your profile first.',
      );
    }

    // ── 3. Check for existing account ────────────────────────────────────────
    const existing = await this.prisma.artisanBankAccount.findUnique({
      where: { artisanProfileId: artisanProfile.id },
    });

    if (existing) {
      throw new ConflictException(
        'You already have a bank account registered. Delete it first to add a new one.',
      );
    }

    // ── 4. Verify the account number via Paystack ────────────────────────────
    this.logger.log(
      `Verifying bank account ${dto.accountNumber} for bank ${dto.bankCode}`,
    );
    const { accountName } = await this.paystackGateway.verifyBankAccount({
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
    });

    // ── 5. Create a Paystack Transfer Recipient (saved for reuse) ────────────
    this.logger.log(`Creating transfer recipient for '${accountName}'`);
    const { recipientCode } = await this.paystackGateway.createRecipient({
      name: accountName,
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
      currency: 'NGN',
    });

    // ── 6. Persist ───────────────────────────────────────────────────────────
    const bankAccount = await this.prisma.artisanBankAccount.create({
      data: {
        artisanProfileId: artisanProfile.id,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName, // verified name from gateway
        paystackRecipientCode: recipientCode,
        isVerified: true,
      },
    });

    this.logger.log(
      `Bank account registered for artisan ${userId} | acct=${dto.accountNumber}`,
    );

    return bankAccount;
  }

  /**
   * Get the bank account for the currently authenticated artisan.
   */
  async findMine(userId: string) {
    const artisanProfile = await this.prisma.artisanProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!artisanProfile) {
      throw new NotFoundException('Artisan profile not found');
    }

    const bankAccount = await this.prisma.artisanBankAccount.findUnique({
      where: { artisanProfileId: artisanProfile.id },
    });

    if (!bankAccount) {
      throw new NotFoundException('No bank account registered yet');
    }

    return bankAccount;
  }

  /**
   * Delete the artisan's bank account.
   * The artisan can only delete their own account.
   */
  async remove(userId: string, id: string) {
    // Load the account and verify ownership
    const bankAccount = await this.prisma.artisanBankAccount.findUnique({
      where: { id },
      include: { artisanProfile: { select: { userId: true } } },
    });

    if (!bankAccount) {
      throw new NotFoundException(`Bank account '${id}' not found`);
    }

    if (bankAccount.artisanProfile.userId !== userId) {
      throw new ForbiddenException('You do not own this bank account');
    }

    await this.prisma.artisanBankAccount.delete({ where: { id } });

    this.logger.log(`Bank account ${id} deleted by artisan ${userId}`);
  }

  /**
   * Verify a bank account number without saving it.
   * Useful for the Flutter app to show the account name before the user submits.
   */
  async verifyAccountNumber(accountNumber: string, bankCode: string) {
    return this.paystackGateway.verifyBankAccount({ accountNumber, bankCode });
  }
}
