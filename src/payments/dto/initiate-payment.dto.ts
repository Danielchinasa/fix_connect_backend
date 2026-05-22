// ─── Initiate Payment DTO ─────────────────────────────────────────────────────
// The request body a customer sends when they want to pay for a booking.

import { IsIn, IsString } from 'class-validator';

export class InitiatePaymentDto {
  /**
   * Currency code. Determines which payment gateway is used:
   *   NGN  → Paystack (with USSD + bank transfer options)
   *   USD / GBP / EUR → Stripe (card only in stub)
   */
  @IsString()
  @IsIn(['NGN', 'USD', 'GBP', 'EUR'], {
    message: 'currency must be one of NGN, USD, GBP, EUR',
  })
  currency: string;
}
