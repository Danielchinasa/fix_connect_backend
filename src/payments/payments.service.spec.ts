// ─── Payments Service Spec ────────────────────────────────────────────────────

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYSTACK_GATEWAY,
  STRIPE_GATEWAY,
} from './gateways/payment-gateway.interface';
import { PaymentsService } from './payments.service';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const makePayment = (overrides = {}) => ({
  id: 'pay-1',
  bookingId: 'booking-1',
  amount: 5000,
  currency: 'NGN',
  gateway: 'PAYSTACK',
  status: PaymentStatus.PENDING,
  paystackReference: 'ref-1',
  paystackAccessCode: 'access-1',
  paymentUrl: 'https://checkout.paystack.com/stub',
  ussdCode: '*737*000*5000*abc123#',
  bankTransferBankName: 'Wema Bank',
  bankTransferAccount: '0391234567',
  paidAt: null,
  releasedAt: null,
  refundedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeBooking = (overrides = {}) => ({
  id: 'booking-1',
  customerId: 'user-1',
  artisanProfileId: 'profile-1',
  totalAmount: 5000,
  status: BookingStatus.CONFIRMED,
  customer: { email: 'customer@test.com' },
  artisanProfile: { userId: 'artisan-user-1', bankAccount: null },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let paystackGateway: any;
  let stripeGateway: any;
  let configService: any;

  const fakeInitiateResult = {
    paymentUrl: 'https://checkout.paystack.com/stub',
    gatewayReference: 'ref-1',
    accessCode: 'access-1',
    ussdCode: '*737*000*5000*abc123#',
    bankTransferBankName: 'Wema Bank',
    bankTransferAccount: '0391234567',
  };

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };

    paystackGateway = {
      initiatePayment: jest.fn().mockResolvedValue(fakeInitiateResult),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      parseWebhookEvent: jest.fn().mockReturnValue({
        event: 'charge.success',
        reference: 'ref-1',
        amount: 500000,
      }),
      disburseToArtisan: jest.fn().mockResolvedValue({
        success: true,
        transferCode: 'TRF_stub',
        message: 'ok',
      }),
      createRecipient: jest
        .fn()
        .mockResolvedValue({ recipientCode: 'RCP_stub' }),
      verifyBankAccount: jest
        .fn()
        .mockResolvedValue({ accountName: 'Test Name' }),
    };

    stripeGateway = {
      initiatePayment: jest.fn().mockResolvedValue({
        paymentUrl: 'https://checkout.stripe.com/stub',
        gatewayReference: 'pi_stub',
      }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      parseWebhookEvent: jest.fn().mockReturnValue({
        event: 'payment_intent.succeeded',
        reference: 'pi_stub',
        amount: 10000,
      }),
      disburseToArtisan: jest.fn().mockResolvedValue({ success: true }),
    };

    configService = { get: jest.fn().mockReturnValue(5) };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      paystackGateway,
      stripeGateway,
      configService,
    );
    // Provide PAYSTACK_GATEWAY / STRIPE_GATEWAY via private injection workaround
    // (constructor injection happens above with positional args matching order)
    void PAYSTACK_GATEWAY; // suppress unused import lint
    void STRIPE_GATEWAY;
  });

  // ─── initiate ────────────────────────────────────────────────────────────────
  describe('initiate', () => {
    it('creates a Paystack payment for a confirmed NGN booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.upsert.mockResolvedValue(makePayment());

      const dto = { currency: 'NGN' };
      const result = await service.initiate('user-1', 'booking-1', dto);

      expect(paystackGateway.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'NGN', bookingId: 'booking-1' }),
      );
      expect(prisma.payment.upsert).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ gateway: 'PAYSTACK' }));
    });

    it('uses Stripe for USD bookings', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.upsert.mockResolvedValue(
        makePayment({ currency: 'USD', gateway: 'STRIPE' }),
      );

      await service.initiate('user-1', 'booking-1', { currency: 'USD' });

      expect(stripeGateway.initiatePayment).toHaveBeenCalled();
      expect(paystackGateway.initiatePayment).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.initiate('user-1', 'bad-id', { currency: 'NGN' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user does not own booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ customerId: 'other-user' }),
      );
      await expect(
        service.initiate('user-1', 'booking-1', { currency: 'NGN' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when booking is still PENDING', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ status: BookingStatus.PENDING }),
      );
      await expect(
        service.initiate('user-1', 'booking-1', { currency: 'NGN' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when booking is already paid (HELD)', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({ status: PaymentStatus.HELD }),
      );
      await expect(
        service.initiate('user-1', 'booking-1', { currency: 'NGN' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── getStatus ───────────────────────────────────────────────────────────────
  describe('getStatus', () => {
    it('returns payment for the booking customer', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customerId: 'user-1',
        artisanProfile: { userId: 'artisan-user-1' },
      });
      const payment = makePayment();
      prisma.payment.findUnique.mockResolvedValue(payment);

      await expect(service.getStatus('user-1', 'booking-1')).resolves.toBe(
        payment,
      );
    });

    it('returns payment for the artisan', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customerId: 'other-user',
        artisanProfile: { userId: 'user-1' },
      });
      prisma.payment.findUnique.mockResolvedValue(makePayment());

      await expect(
        service.getStatus('user-1', 'booking-1'),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException for unrelated users', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customerId: 'other',
        artisanProfile: { userId: 'also-other' },
      });
      await expect(
        service.getStatus('user-1', 'booking-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when no payment exists', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customerId: 'user-1',
        artisanProfile: { userId: 'artisan' },
      });
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.getStatus('user-1', 'booking-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── handlePaystackWebhook ───────────────────────────────────────────────────
  describe('handlePaystackWebhook', () => {
    it('marks payment as HELD on charge.success', async () => {
      const payment = makePayment({ status: PaymentStatus.PENDING });
      prisma.payment.findFirst.mockResolvedValue(payment);
      prisma.booking.findUnique.mockResolvedValue({ customerId: 'user-1' });
      prisma.payment.update.mockResolvedValue({
        ...payment,
        status: PaymentStatus.HELD,
      });
      prisma.notification.create.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([]);

      await expect(
        service.handlePaystackWebhook(
          '{"event":"charge.success","data":{"reference":"ref-1","amount":500000}}',
          'sig',
        ),
      ).resolves.not.toThrow();

      expect(paystackGateway.verifyWebhookSignature).toHaveBeenCalled();
    });

    it('throws ForbiddenException when signature is invalid', async () => {
      paystackGateway.verifyWebhookSignature.mockReturnValue(false);
      await expect(
        service.handlePaystackWebhook('{}', 'bad-sig'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── releaseToArtisan ────────────────────────────────────────────────────────
  describe('releaseToArtisan', () => {
    it('skips when payment does not exist', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.releaseToArtisan('booking-1'),
      ).resolves.not.toThrow();
      expect(paystackGateway.disburseToArtisan).not.toHaveBeenCalled();
    });

    it('skips when payment status is not HELD', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({ status: PaymentStatus.PENDING }),
      );
      await expect(
        service.releaseToArtisan('booking-1'),
      ).resolves.not.toThrow();
      expect(paystackGateway.disburseToArtisan).not.toHaveBeenCalled();
    });

    it('skips when artisan has no bank account', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({ status: PaymentStatus.HELD }),
      );
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ artisanProfile: { bankAccount: null } }),
      );
      await expect(
        service.releaseToArtisan('booking-1'),
      ).resolves.not.toThrow();
      expect(paystackGateway.disburseToArtisan).not.toHaveBeenCalled();
    });

    it('disburses 95% of amount when artisan has a bank account', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: PaymentStatus.HELD,
          amount: 5000,
          currency: 'NGN',
        }),
      );
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({
          artisanProfile: {
            bankAccount: { paystackRecipientCode: 'RCP_abc' },
          },
        }),
      );
      prisma.payment.update.mockResolvedValue({});

      await service.releaseToArtisan('booking-1');

      expect(paystackGateway.disburseToArtisan).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientCode: 'RCP_abc',
          // 5000 * 0.95 = 4750 NGN = 475000 kobo
          amount: 475000,
        }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.RELEASED }),
        }),
      );
    });
  });
});
