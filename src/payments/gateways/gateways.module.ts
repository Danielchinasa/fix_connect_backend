// ─── Gateways Module ──────────────────────────────────────────────────────────
// A shared module that provides and exports both payment gateway stubs.
// Both PaymentsModule and BankAccountsModule import this.
// When you have real keys, swap the stubs out here — nothing else changes.

import { Module } from '@nestjs/common';
import { PAYSTACK_GATEWAY, STRIPE_GATEWAY } from './payment-gateway.interface';
import { PaystackGatewayService } from './paystack.gateway';
import { StripeGatewayService } from './stripe.gateway';

@Module({
  providers: [
    // Register PaystackGatewayService under the PAYSTACK_GATEWAY injection token
    { provide: PAYSTACK_GATEWAY, useClass: PaystackGatewayService },
    // Register StripeGatewayService under the STRIPE_GATEWAY injection token
    { provide: STRIPE_GATEWAY, useClass: StripeGatewayService },
  ],
  exports: [PAYSTACK_GATEWAY, STRIPE_GATEWAY],
})
export class GatewaysModule {}
