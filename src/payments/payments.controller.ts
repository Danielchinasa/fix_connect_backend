// ─── Payments Controller ──────────────────────────────────────────────────────
// Routes:
//   POST   /payments/initiate/:bookingId    → customer initiates payment
//   GET    /payments/booking/:bookingId     → check payment status
//   POST   /payments/webhook/paystack       → Paystack webhook (NO auth)
//   POST   /payments/webhook/stripe         → Stripe webhook (NO auth)
//
// Webhook routes must NOT have JWT guards because Paystack/Stripe call them
// directly and have no Bearer token. They are secured by signature verification
// inside the service instead.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Authenticated Routes ─────────────────────────────────────────────────

  /**
   * POST /payments/initiate/:bookingId
   * Customer calls this to start a payment session for their booking.
   * Returns a paymentUrl (and USSD/bank-transfer codes for NGN) that the
   * Flutter app uses to direct the user to checkout.
   */
  @Post('initiate/:bookingId')
  @UseGuards(JwtAuthGuard)
  initiate(
    @CurrentUser('sub') userId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiate(userId, bookingId, dto);
  }

  /**
   * GET /payments/booking/:bookingId
   * Get the current payment status and details for a booking.
   * Accessible by both the customer and the artisan on the booking.
   */
  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  getStatus(
    @CurrentUser('sub') userId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.paymentsService.getStatus(userId, bookingId);
  }

  // ─── Webhook Routes (No JWT Auth) ─────────────────────────────────────────

  /**
   * POST /payments/webhook/paystack
   * Paystack calls this URL when a payment event occurs (e.g. charge.success).
   * The x-paystack-signature header is verified inside the service.
   *
   * Setup in Paystack dashboard: Settings → API Keys & Webhooks → Webhook URL
   *
   * NOTE: For production you need the raw body for HMAC-SHA512 verification.
   * Enable rawBody: true in main.ts NestFactory options.
   */
  @Post('webhook/paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(@Req() req: RawBodyRequest<Request>) {
    // Use raw body string if available (for real signature verification)
    // Fall back to JSON body for the stub
    const payload: string = req.rawBody?.toString() ?? JSON.stringify(req.body);
    const signature = (req.headers['x-paystack-signature'] as string) ?? '';

    await this.paymentsService.handlePaystackWebhook(payload, signature);
    // Always return 200 to Paystack — they retry on non-2xx
    return { received: true };
  }

  /**
   * POST /payments/webhook/stripe
   * Stripe calls this URL when a payment event occurs (e.g. payment_intent.succeeded).
   * The stripe-signature header is verified inside the service.
   *
   * Setup in Stripe dashboard: Developers → Webhooks → Add endpoint
   *
   * NOTE: Stripe REQUIRES the raw body Buffer for signature verification.
   * Enable rawBody: true in main.ts NestFactory options.
   */
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
    const payload: string = req.rawBody?.toString() ?? JSON.stringify(req.body);
    const signature = (req.headers['stripe-signature'] as string) ?? '';

    await this.paymentsService.handleStripeWebhook(payload, signature);
    return { received: true };
  }
}
