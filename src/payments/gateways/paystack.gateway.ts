// ─── Paystack Gateway Service (Stubbed) ──────────────────────────────────────
// This is a STUB — it logs what WOULD happen and returns realistic fake data.
// When you have your Paystack secret key, replace each TODO block with the real
// Axios/Paystack SDK call. All method signatures stay exactly the same.
//
// Real API docs: https://paystack.com/docs/api/

import { Injectable, Logger } from '@nestjs/common';
import {
  GatewayDisburseParams,
  GatewayDisburseResult,
  GatewayInitiateParams,
  GatewayInitiateResult,
  PaymentGatewayInterface,
} from './payment-gateway.interface';

@Injectable()
export class PaystackGatewayService implements PaymentGatewayInterface {
  private readonly logger = new Logger(PaystackGatewayService.name);

  // ─── TODO: Uncomment when you have your keys ─────────────────────────────
  // constructor(private readonly config: ConfigService) {}
  // private readonly secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY');
  // private readonly headers = {
  //   Authorization: `Bearer ${this.secretKey}`,
  //   'Content-Type': 'application/json',
  // };

  async initiatePayment(
    params: GatewayInitiateParams,
  ): Promise<GatewayInitiateResult> {
    this.logger.log(
      `[STUB] Initiating Paystack payment | booking=${params.bookingId} | ` +
        `amount=${params.amount} kobo (₦${params.amount / 100}) | ref=${params.reference}`,
    );

    // TODO: Replace this entire block with a real Paystack API call:
    // const { data } = await axios.post(
    //   'https://api.paystack.co/transaction/initialize',
    //   {
    //     email: params.customerEmail,
    //     amount: params.amount,           // kobo
    //     currency: params.currency,
    //     reference: params.reference,
    //     metadata: { bookingId: params.bookingId },
    //     channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    //   },
    //   { headers: this.headers },
    // );
    // return {
    //   paymentUrl:           data.data.authorization_url,
    //   gatewayReference:     data.data.reference,
    //   accessCode:           data.data.access_code,
    //   ussdCode:             `*737*000*${params.amount / 100}*${params.reference}#`,
    //   bankTransferBankName: 'Wema Bank (ALAT)',
    //   bankTransferAccount:  data.data.bank_transfer?.account_number,
    // };

    // ─── Stub response (realistic fake data) ─────────────────────────────────
    const fakeRef = params.reference;
    const nairaAmount = Math.round(params.amount / 100);
    return {
      paymentUrl: `https://checkout.paystack.com/stub_${fakeRef}`,
      gatewayReference: fakeRef,
      accessCode: `stub_access_${fakeRef}`,
      // GTBank USSD shortcode format: *737*000*<amount>*<last6ofref>#
      ussdCode: `*737*000*${nairaAmount}*${fakeRef.slice(-6)}#`,
      bankTransferBankName: 'Wema Bank (ALAT)',
      // 10-digit fake virtual account number
      bankTransferAccount: `039${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`,
    };
  }

  verifyWebhookSignature(payload: Buffer | string, signature: string): boolean {
    this.logger.log(
      '[STUB] Paystack webhook signature check — always passes in stub mode',
    );

    // TODO: Replace with real HMAC-SHA512 verification:
    // const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    // const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    // return hash === signature;

    // Intentionally void the unused var lint warning for the stub
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

    // Paystack webhook shape: { event: "charge.success", data: { reference, amount } }
    return {
      event: (body.event as string) ?? '',
      reference: (body.data?.reference as string) ?? '',
      amount: (body.data?.amount as number) ?? 0, // in kobo
    };
  }

  async disburseToArtisan(
    params: GatewayDisburseParams,
  ): Promise<GatewayDisburseResult> {
    this.logger.log(
      `[STUB] Paystack disbursement | booking=${params.bookingId} | ` +
        `amount=${params.amount} kobo (₦${params.amount / 100}) | recipient=${params.recipientCode}`,
    );

    // TODO: Replace with real Paystack Transfer API call:
    // const { data } = await axios.post(
    //   'https://api.paystack.co/transfer',
    //   {
    //     source: 'balance',
    //     amount: params.amount,
    //     recipient: params.recipientCode,
    //     reason: `FixConnect payout for booking ${params.bookingId}`,
    //     reference: params.reference,
    //   },
    //   { headers: this.headers },
    // );
    // return { success: true, transferCode: data.data.transfer_code, message: 'Transfer initiated' };

    return {
      success: true,
      transferCode: `TRF_stub_${params.reference}`,
      message: 'Transfer initiated (stub)',
    };
  }

  async createRecipient(params: {
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
  }): Promise<{ recipientCode: string }> {
    this.logger.log(
      `[STUB] Creating Paystack transfer recipient | name=${params.name} | acct=${params.accountNumber} | bank=${params.bankCode}`,
    );

    // TODO: Replace with real Paystack Transfer Recipient API call:
    // const { data } = await axios.post(
    //   'https://api.paystack.co/transferrecipient',
    //   {
    //     type: 'nuban',
    //     name: params.name,
    //     account_number: params.accountNumber,
    //     bank_code: params.bankCode,
    //     currency: params.currency,
    //   },
    //   { headers: this.headers },
    // );
    // return { recipientCode: data.data.recipient_code };

    return { recipientCode: `RCP_stub_${Date.now()}` };
  }

  async verifyBankAccount(params: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountName: string }> {
    this.logger.log(
      `[STUB] Verifying bank account | acct=${params.accountNumber} | bank=${params.bankCode}`,
    );

    // TODO: Replace with real Paystack Account Verification call:
    // const { data } = await axios.get(
    //   `https://api.paystack.co/bank/resolve?account_number=${params.accountNumber}&bank_code=${params.bankCode}`,
    //   { headers: this.headers },
    // );
    // return { accountName: data.data.account_name };

    return { accountName: 'STUB VERIFIED ACCOUNT NAME' };
  }
}
