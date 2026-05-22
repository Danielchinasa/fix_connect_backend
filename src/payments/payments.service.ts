// ─── Payments Service ─────────────────────────────────────────────────────────
// Handles the full escrow payment lifecycle:
//
//  1. Customer calls initiate() → gateway creates a checkout session
//  2. Customer pays on the gateway's checkout page
//  3. Gateway fires a webhook → handlePaystackWebhook / handleStripeWebhook
//  4. We mark the payment as HELD (funds sit in escrow)
//  5. When the booking is marked COMPLETED, BookingsService calls releaseToArtisan()
//  6. We disburse (booking amount − platform commission) to the artisan's bank
//
// Commission rate is controlled by the PLATFORM_COMMISSION_PERCENT env variable.
// Default: 5% (artisan receives 95% of the booking amount).

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, NotificationType, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYSTACK_GATEWAY,
  STRIPE_GATEWAY,
} from './gateways/payment-gateway.interface';
import type { PaymentGatewayInterface } from './gateways/payment-gateway.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly commissionPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYSTACK_GATEWAY)
    private readonly paystackGateway: PaymentGatewayInterface,
    @Inject(STRIPE_GATEWAY)
    private readonly stripeGateway: PaymentGatewayInterface,
    private readonly configService: ConfigService,
  ) {
    // Read commission from env; defaults to 5 if not set
    this.commissionPercent = this.configService.get<number>(
      'PLATFORM_COMMISSION_PERCENT',
      5,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initiate a payment session for a booking.
   * Only the customer who owns the booking can call this.
   * Returns payment URLs / codes the Flutter app displays to the user.
   */
  async initiate(userId: string, bookingId: string, dto: InitiatePaymentDto) {
    // ── 1. Load booking and verify ownership ────────────────────────────────
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { select: { email: true } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking '${bookingId}' not found`);
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException('You do not own this booking');
    }

    // ── 2. Booking must be confirmed before payment ──────────────────────────
    if (booking.status === BookingStatus.PENDING) {
      throw new BadRequestException(
        'The artisan must confirm the booking before you can pay',
      );
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.DISPUTED
    ) {
      throw new BadRequestException(
        `Cannot pay for a booking with status '${booking.status}'`,
      );
    }

    // ── 3. Prevent double-payment ────────────────────────────────────────────
    const existing = await this.prisma.payment.findUnique({
      where: { bookingId },
    });
    if (
      existing &&
      existing.status !== PaymentStatus.PENDING &&
      existing.status !== PaymentStatus.FAILED
    ) {
      throw new BadRequestException(
        `Payment already processed (status: ${existing.status})`,
      );
    }

    // ── 4. Select gateway by currency ────────────────────────────────────────
    const currency = dto.currency;
    const gateway = this.selectGateway(currency);
    const gatewayName = currency === 'NGN' ? 'PAYSTACK' : 'STRIPE';

    // Unique reference we generate (used to reconcile the webhook event)
    const reference = `fc_${bookingId.slice(-8)}_${Date.now()}`;

    // Gateways expect the amount in their smallest unit (kobo / cents)
    const amountInSmallestUnit = Math.round(booking.totalAmount * 100);

    // ── 5. Call the gateway ──────────────────────────────────────────────────
    const gatewayResult = await gateway.initiatePayment({
      amount: amountInSmallestUnit,
      currency,
      reference,
      customerEmail: booking.customer.email,
      bookingId,
    });

    // ── 6. Persist / update the Payment record ───────────────────────────────
    const payment = await this.prisma.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        amount: booking.totalAmount,
        currency,
        gateway: gatewayName,
        paystackReference: gatewayResult.gatewayReference,
        paystackAccessCode: gatewayResult.accessCode ?? null,
        paymentUrl: gatewayResult.paymentUrl,
        ussdCode: gatewayResult.ussdCode ?? null,
        bankTransferBankName: gatewayResult.bankTransferBankName ?? null,
        bankTransferAccount: gatewayResult.bankTransferAccount ?? null,
        status: PaymentStatus.PENDING,
      },
      update: {
        // Allow re-initiating a PENDING / FAILED payment (e.g. user reopens flow)
        gateway: gatewayName,
        paystackReference: gatewayResult.gatewayReference,
        paystackAccessCode: gatewayResult.accessCode ?? null,
        paymentUrl: gatewayResult.paymentUrl,
        ussdCode: gatewayResult.ussdCode ?? null,
        bankTransferBankName: gatewayResult.bankTransferBankName ?? null,
        bankTransferAccount: gatewayResult.bankTransferAccount ?? null,
        status: PaymentStatus.PENDING,
      },
    });

    this.logger.log(
      `Payment initiated | booking=${bookingId} | gateway=${gatewayName} | ` +
        `amount=₦${booking.totalAmount} | ref=${reference}`,
    );

    return payment;
  }

  /**
   * Get the current payment record for a booking.
   * Both the customer and the artisan on the booking can view this.
   */
  async getStatus(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        customerId: true,
        artisanProfile: { select: { userId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking '${bookingId}' not found`);
    }

    const isCustomer = booking.customerId === userId;
    const isArtisan = booking.artisanProfile?.userId === userId;

    if (!isCustomer && !isArtisan) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });
    if (!payment) {
      throw new NotFoundException('No payment record found for this booking');
    }

    return payment;
  }

  /**
   * Process an incoming Paystack webhook.
   * The controller passes the raw body string and the x-paystack-signature header.
   * We verify the signature then update the payment status.
   */
  async handlePaystackWebhook(
    payload: string,
    signature: string,
  ): Promise<void> {
    if (!this.paystackGateway.verifyWebhookSignature(payload, signature)) {
      throw new ForbiddenException('Invalid Paystack webhook signature');
    }

    const { event, reference, amount } =
      this.paystackGateway.parseWebhookEvent(payload);
    this.logger.log(`[Paystack Webhook] event=${event} | ref=${reference}`);

    if (event === 'charge.success') {
      await this.markPaymentHeld(reference, amount, 'paystackReference');
    }

    // Future events to handle:
    // 'charge.dispute.create'  → flag booking as DISPUTED
    // 'refund.processed'       → mark as REFUNDED
  }

  /**
   * Process an incoming Stripe webhook.
   * The controller passes the raw body string and the stripe-signature header.
   * NOTE: For production, Stripe requires the raw Buffer, not a JSON string.
   * See main.ts for how to enable rawBody: true in NestFactory.
   */
  async handleStripeWebhook(payload: string, signature: string): Promise<void> {
    if (!this.stripeGateway.verifyWebhookSignature(payload, signature)) {
      throw new ForbiddenException('Invalid Stripe webhook signature');
    }

    const { event, reference, amount } =
      this.stripeGateway.parseWebhookEvent(payload);
    this.logger.log(`[Stripe Webhook] event=${event} | ref=${reference}`);

    if (event === 'payment_intent.succeeded') {
      // Stripe uses PaymentIntent IDs (pi_...) as the reference stored in paystackReference
      await this.markPaymentHeld(reference, amount, 'paystackReference');
    }
  }

  /**
   * Disburse the booking amount (minus platform commission) to the artisan.
   * Called automatically by BookingsService when a booking is marked COMPLETED.
   * Uses fire-and-forget in BookingsService so a gateway error never blocks the status update.
   */
  async releaseToArtisan(bookingId: string): Promise<void> {
    // ── 1. Verify payment is in HELD state ───────────────────────────────────
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });

    if (!payment) {
      this.logger.warn(
        `[Release] No payment record for booking ${bookingId} — nothing to release`,
      );
      return;
    }

    if (payment.status !== PaymentStatus.HELD) {
      this.logger.warn(
        `[Release] Payment for booking ${bookingId} is not HELD (status: ${payment.status}) — skipping`,
      );
      return;
    }

    // ── 2. Load artisan bank account ─────────────────────────────────────────
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        artisanProfile: {
          include: { bankAccount: true },
        },
      },
    });

    if (!booking?.artisanProfile?.bankAccount?.paystackRecipientCode) {
      this.logger.warn(
        `[Release] Artisan has no verified bank account for booking ${bookingId}. ` +
          'Funds remain HELD until the artisan registers a bank account.',
      );
      // In production you'd notify the artisan here to register their account
      return;
    }

    // ── 3. Calculate payout after platform commission ────────────────────────
    const commission = (this.commissionPercent / 100) * payment.amount;
    const payout = payment.amount - commission;

    this.logger.log(
      `[Release] booking=${bookingId} | total=₦${payment.amount} | ` +
        `commission=${this.commissionPercent}% (₦${commission.toFixed(2)}) | payout=₦${payout.toFixed(2)}`,
    );

    // ── 4. Call the gateway to transfer funds ────────────────────────────────
    const gateway = this.selectGateway(payment.currency);
    const reference = `release_${bookingId.slice(-8)}_${Date.now()}`;

    const result = await gateway.disburseToArtisan({
      amount: Math.round(payout * 100), // smallest unit
      currency: payment.currency,
      recipientCode: booking.artisanProfile.bankAccount.paystackRecipientCode,
      reference,
      bookingId,
    });

    // ── 5. Update payment status ─────────────────────────────────────────────
    if (result.success) {
      await this.prisma.payment.update({
        where: { bookingId },
        data: { status: PaymentStatus.RELEASED, releasedAt: new Date() },
      });
      this.logger.log(
        `[Release] Funds released for booking ${bookingId} | transferCode=${result.transferCode}`,
      );
    } else {
      this.logger.error(
        `[Release] Disbursement FAILED for booking ${bookingId}: ${result.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Choose a gateway based on the payment currency.
   * NGN → Paystack, everything else → Stripe.
   */
  private selectGateway(currency: string): PaymentGatewayInterface {
    return currency === 'NGN' ? this.paystackGateway : this.stripeGateway;
  }

  /**
   * Find the payment by gateway reference, mark it as HELD (escrow received),
   * and create an in-app notification for the customer.
   *
   * @param reference   The gateway reference stored during initiation
   * @param _amount     Amount in smallest unit (currently unused — we trust our stored amount)
   * @param refField    Which Prisma field to search ('paystackReference')
   */
  private async markPaymentHeld(
    reference: string,
    _amount: number,
    _refField: 'paystackReference',
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { paystackReference: reference },
    });

    if (!payment) {
      this.logger.warn(
        `[Webhook] No payment found for reference '${reference}'`,
      );
      return;
    }

    // Find the customer to create the notification
    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
      select: { customerId: true },
    });

    if (!booking) return;

    // Update payment and create notification in a transaction
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.HELD, paidAt: new Date() },
      }),
      this.prisma.notification.create({
        data: {
          userId: booking.customerId,
          bookingId: payment.bookingId,
          type: NotificationType.PAYMENT_SUCCESS,
          title: 'Payment received',
          body:
            `Your payment of ${payment.currency} ${payment.amount.toLocaleString('en-NG')} ` +
            'has been received and held securely until the job is completed.',
        },
      }),
    ]);

    this.logger.log(
      `[Payment] Booking ${payment.bookingId} marked HELD | amount=${payment.currency} ${payment.amount}`,
    );
  }
}
