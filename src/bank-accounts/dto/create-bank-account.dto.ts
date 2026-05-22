// ─── Create Bank Account DTO ──────────────────────────────────────────────────

import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateBankAccountDto {
  /** Bank name as displayed to the user e.g. "Guaranty Trust Bank" */
  @IsString()
  @IsNotEmpty()
  bankName: string;

  /**
   * Paystack bank code — a 3-digit string.
   * Full list: GET https://api.paystack.co/bank
   * Examples: "058" (GTBank), "011" (FirstBank), "033" (UBA), "044" (Access)
   */
  @IsString()
  @Matches(/^\d{3}$/, {
    message: 'bankCode must be a 3-digit string e.g. "058"',
  })
  bankCode: string;

  /** 10-digit NUBAN account number */
  @IsString()
  @Length(10, 10, { message: 'accountNumber must be exactly 10 digits' })
  @Matches(/^\d{10}$/, { message: 'accountNumber must contain only digits' })
  accountNumber: string;
}
