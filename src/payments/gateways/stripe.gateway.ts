// ─── Stripe Gateway Service (Stubbed) ────────────────────────────────────────
// STUB — logs what would happen, returns realistic-looking fake data.
// When you have your Stripe secret key, replace each TODO block with real SDK
// calls using `npm install stripe`.
//
// Real API docs: https://stripe.com/docs/api
// Stripe requires the RAW request body for webhook signature verification.
// See main.ts for the rawBody middleware you'll need when going live.

import { Injectable, Logger } from '@nestjs/common';
import {
  GatewayDisburseParams,
  GatewayDisburseResult,
  GatewayInitiateParams,
  GatewayInitiateResult,
  PaymentGatewayInterface,
} from './payment-gateway.interface';

@Injectable()
export class StripeGatewayService implements PaymentGatewayInterface {
  private readonly logger = new Logger(StripeGatewayService.name);

  // ─── TODO: Uncomment when you have your keys ─────────────────────────────
  // constructor(private readonly config: ConfigService) {}
  // private readonly stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY'), {
  //   apiVersion: '2024-04-10',
  // });

  async initiatePayment(
    params: GatewayInitiateParams,
  ): Promise<GatewayInitiateResult> {
    this.logger.log(
      `[STUB] Initiating Stripe payment | booking=${params.bookingId} | ` +
        `amount=${params.amount} cents ($${params.amount / 100}) | ref=${params.reference}`,
    );

    // TODO: Replace with real Stripe Checkout Session creation:
    // const session = await this.stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   line_items: [{
    //     price_data: {
    //       currency: params.currency.toLowerCase(),
    //       unit_amount: params.amount,
    //       product_data: { name: `FixConnect Booking ${params.bookingId}` },
    //     },
    //     quantity: 1,
    //   }],
    //   mode: 'payment',
    //   success_url: `${process.env.FRONTEND_URL}/payment/success?ref=${params.reference}`,
    //   cancel_url:  `${process.env.FRONTEND_URL}/payment/cancel`,
    //   client_reference_id: params.reference,
    //   metadata: { bookingId: params.bookingId },
    // });
    // return {
    //   paymentUrl:       session.url!,
    //   gatewayReference: session.payment_intent as string,
    // };

    // ─── Stub response ────────────────────────────────────────────────────────
    const fakeIntentId = `pi_stub_${params.reference}`;
    return {
      paymentUrl: `https://checkout.stripe.com/pay/stub_${params.reference}`,
      gatewayReference: fakeIntentId,
      // Stripe does not provide USSD or bank transfer codes
    };
  }

  verifyWebhookSignature(payload: Buffer | string, signature: string): boolean {
    this.logger.log(
      '[STUB] Stripe webhook signature check — always passes in stub mode',
    );

    // TODO: Replace with real Stripe signature check:
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // try {
    //   this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    //   return true;
    // } catch {
    //   return false;
    // }
    // IMPORTANT: payload MUST be the raw Buffer (not parsed JSON) for Stripe.
    // Enable rawBody: true in main.ts NestFactory.create options.

    void signature;
    return true;
  }

  parseWebhookEvent(payload: Buffer | string): {
    event: string;
    reference: string;
    amount: number;
  } {
    const body: Record<string, any> =
      typeof payload === 'string'
        ? JSON.parse(payload)
        : JSON.parse(payload.toString());

    // Stripe webhook shape: { type: "payment_intent.succeeded", data: { object: { id, amount } } }
    return {
      event: (body.type as string) ?? '',
      // For Stripe, the reference is the PaymentIntent ID stored during initiation
      reference: (body.data?.object?.id as string) ?? '',
      amount: (body.data?.object?.amount as number) ?? 0, // in cents
    };
  }

  async disburseToArtisan(
    params: GatewayDisburseParams,
  ): Promise<GatewayDisburseResult> {
    this.logger.log(
      `[STUB] Stripe disbursement | booking=${params.bookingId} | ` +
        `amount=${params.amount} cents | recipient=${params.recipientCode}`,
    );

    // TODO: Replace with real Stripe Connect Transfer:
    // const transfer = await this.stripe.transfers.create({
    //   amount: params.amount,
    //   currency: params.currency.toLowerCase(),
    //   destination: params.recipientCode, // Stripe Connect account ID
    //   transfer_group: params.bookingId,
    //   metadata: { reference: params.reference },
    // });
    // return { success: true, transferCode: transfer.id, message: 'Stripe transfer created' };

    return {
      success: true,
      transferCode: `tr_stub_${params.reference}`,
      message: 'Stripe transfer initiated (stub)',
    };
  }

  async createRecipient(params: {
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
  }): Promise<{ recipientCode: string }> {
    this.logger.log(
      `[STUB] Creating Stripe Connect account | name=${params.name}`,
    );

    // TODO: Replace with real Stripe Connect Express Account creation:
    // const account = await this.stripe.accounts.create({
    //   type: 'express',
    //   country: 'GB',        // adjust per artisan country
    //   email: params.name,   // pass email, not name here in real call
    //   capabilities: { transfers: { requested: true } },
    // });
    // return { recipientCode: account.id };

    void params;
    return { recipientCode: `acct_stub_${Date.now()}` };
  }

  async verifyBankAccount(params: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountName: string }> {
    // Stripe does not offer a real-time bank account name lookup.
    // For production, use a dedicated service like Plaid or manual verification.
    this.logger.log(
      `[STUB] Stripe bank verification — manual verification required in production | ` +
        `acct=${params.accountNumber}`,
    );
    void params;
    return { accountName: 'Manually Verified' };
  }
}
