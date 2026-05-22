// ─── Payments Module ──────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewaysModule } from './gateways/gateways.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    ConfigModule, // needed for ConfigService (commission %)
    GatewaysModule, // provides PAYSTACK_GATEWAY and STRIPE_GATEWAY tokens
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  // Export PaymentsService so BookingsModule can call releaseToArtisan()
  exports: [PaymentsService],
})
export class PaymentsModule {}
