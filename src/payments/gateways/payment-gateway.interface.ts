// ─── Payment Gateway Interface ────────────────────────────────────────────────
// Every gateway (Paystack, Stripe, etc.) must implement this interface.
// This is the "contract" that allows PaymentsService to stay gateway-agnostic.
// When you add a new gateway, create a class that implements this and register
// it in GatewaysModule.

// Injection tokens used with @Inject() to choose which gateway to receive
export const PAYSTACK_GATEWAY = 'PAYSTACK_GATEWAY';
export const STRIPE_GATEWAY = 'STRIPE_GATEWAY';

// ─── Input / Output shapes ────────────────────────────────────────────────────

export interface GatewayInitiateParams {
  /** Amount in the gateway's smallest unit (kobo for NGN, cents for USD) */
  amount: number;
  currency: string;
  /** A unique reference string you generate; used to look up the transaction later */
  reference: string;
  customerEmail: string;
  /** Stored as metadata so the webhook can map the event back to a booking */
  bookingId: string;
}

export interface GatewayInitiateResult {
  /** URL to redirect the customer to complete payment */
  paymentUrl: string;
  /** The gateway's own reference / access code (used to verify later) */
  gatewayReference: string;
  /** Paystack access code for the JS inline popup */
  accessCode?: string;
  /** USSD shortcode e.g. *737*000*5000*ref# */
  ussdCode?: string;
  /** Virtual bank account for direct bank transfer (Paystack only) */
  bankTransferBankName?: string;
  bankTransferAccount?: string;
}

export interface GatewayDisburseParams {
  /** Amount to send in smallest unit (after platform commission deduction) */
  amount: number;
  currency: string;
  /** Paystack recipient code OR Stripe Connect account ID */
  recipientCode: string;
  /** Unique reference for this transfer */
  reference: string;
  bookingId: string;
}

export interface GatewayDisburseResult {
  success: boolean;
  /** Gateway transfer code for audit logs */
  transferCode?: string;
  message: string;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface PaymentGatewayInterface {
  /**
   * Start a payment session and return URLs / codes for the customer.
   * Called when a customer presses "Pay Now" on the booking.
   */
  initiatePayment(
    params: GatewayInitiateParams,
  ): Promise<GatewayInitiateResult>;

  /**
   * Verify that an incoming webhook body was actually sent by the gateway.
   * Paystack: HMAC-SHA512 of the raw body using the webhook secret.
   * Stripe: Uses stripe.webhooks.constructEvent().
   */
  verifyWebhookSignature(payload: Buffer | string, signature: string): boolean;

  /**
   * Extract the event type and relevant IDs from a raw webhook body.
   * Called AFTER verifyWebhookSignature returns true.
   */
  parseWebhookEvent(payload: Buffer | string): {
    event: string; // e.g. "charge.success" (Paystack) or "payment_intent.succeeded" (Stripe)
    reference: string; // The transaction reference we generated in initiatePayment
    amount: number; // Amount in smallest unit
  };

  /**
   * Transfer money from the platform's account to the artisan's bank account.
   * Called automatically when a booking is marked COMPLETED.
   */
  disburseToArtisan(
    params: GatewayDisburseParams,
  ): Promise<GatewayDisburseResult>;

  /**
   * Create a transfer recipient (payout destination) for an artisan.
   * Called once when an artisan registers their bank account.
   * Returns a recipientCode that is saved and reused for all future payouts.
   */
  createRecipient(params: {
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
  }): Promise<{ recipientCode: string }>;

  /**
   * Verify that a bank account number is valid and return the account holder name.
   * Used during bank account registration to prevent typos.
   */
  verifyBankAccount(params: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountName: string }>;
}
