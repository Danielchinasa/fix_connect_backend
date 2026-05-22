// ─── Bank Accounts Controller ─────────────────────────────────────────────────
// All routes require authentication. ARTISAN role is enforced in the service.
//
//   POST   /bank-accounts             → register bank account
//   GET    /bank-accounts/me          → get my bank account
//   GET    /bank-accounts/verify      → verify account number (before submitting)
//   DELETE /bank-accounts/:id         → delete bank account

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  /**
   * POST /bank-accounts
   * Register a bank account for payout.
   * ARTISAN only — this is where disbursements will be sent.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ARTISAN)
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.bankAccountsService.create(userId, dto);
  }

  /**
   * GET /bank-accounts/me
   * Retrieve the artisan's registered bank account.
   * ARTISAN only.
   */
  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTISAN)
  findMine(@CurrentUser('sub') userId: string) {
    return this.bankAccountsService.findMine(userId);
  }

  /**
   * GET /bank-accounts/verify?accountNumber=0123456789&bankCode=058
   * Verify a bank account number and return the account holder name.
   * Call this before the user submits the form — shows them their name to confirm.
   * ARTISAN only.
   */
  @Get('verify')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTISAN)
  verify(
    @Query('accountNumber') accountNumber: string,
    @Query('bankCode') bankCode: string,
  ) {
    return this.bankAccountsService.verifyAccountNumber(
      accountNumber,
      bankCode,
    );
  }

  /**
   * DELETE /bank-accounts/:id
   * Remove a registered bank account.
   * ARTISAN only — can only delete their own account.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTISAN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.bankAccountsService.remove(userId, id);
  }
}
