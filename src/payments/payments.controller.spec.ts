// ─── Payments Controller Spec ─────────────────────────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: {
    initiate: jest.Mock;
    getStatus: jest.Mock;
    handlePaystackWebhook: jest.Mock;
    handleStripeWebhook: jest.Mock;
  };

  const mockPayment = {
    id: 'pay-1',
    bookingId: 'booking-1',
    amount: 5000,
    currency: 'NGN',
    gateway: 'PAYSTACK',
    paymentUrl: 'https://checkout.paystack.com/stub',
    status: 'PENDING',
  };

  beforeEach(async () => {
    service = {
      initiate: jest.fn().mockResolvedValue(mockPayment),
      getStatus: jest.fn().mockResolvedValue(mockPayment),
      handlePaystackWebhook: jest.fn().mockResolvedValue(undefined),
      handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: service }],
    })
      // Override JWT guard so controller tests don't need real tokens
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiate', () => {
    it('calls service.initiate and returns result', async () => {
      const dto = { currency: 'NGN' };
      const result = await controller.initiate('user-1', 'booking-1', dto);
      expect(service.initiate).toHaveBeenCalledWith('user-1', 'booking-1', dto);
      expect(result).toBe(mockPayment);
    });
  });

  describe('getStatus', () => {
    it('calls service.getStatus and returns result', async () => {
      const result = await controller.getStatus('user-1', 'booking-1');
      expect(service.getStatus).toHaveBeenCalledWith('user-1', 'booking-1');
      expect(result).toBe(mockPayment);
    });
  });

  describe('handlePaystackWebhook', () => {
    it('calls service and returns { received: true }', async () => {
      const mockReq: any = {
        rawBody: Buffer.from('{"event":"charge.success"}'),
        body: {},
        headers: { 'x-paystack-signature': 'sig-abc' },
      };
      const result = await controller.handlePaystackWebhook(mockReq);
      expect(service.handlePaystackWebhook).toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });

  describe('handleStripeWebhook', () => {
    it('calls service and returns { received: true }', async () => {
      const mockReq: any = {
        rawBody: Buffer.from('{"type":"payment_intent.succeeded"}'),
        body: {},
        headers: { 'stripe-signature': 'sig-xyz' },
      };
      const result = await controller.handleStripeWebhook(mockReq);
      expect(service.handleStripeWebhook).toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });
});
