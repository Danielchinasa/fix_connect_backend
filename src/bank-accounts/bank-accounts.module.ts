// ─── Bank Accounts Module ─────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { GatewaysModule } from '../payments/gateways/gateways.module';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';

@Module({
  imports: [
    GatewaysModule, // provides PAYSTACK_GATEWAY for account verification
  ],
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
})
export class BankAccountsModule {}
