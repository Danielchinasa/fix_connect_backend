-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "bankTransferAccount" TEXT,
ADD COLUMN     "bankTransferBankName" TEXT,
ADD COLUMN     "gateway" TEXT NOT NULL DEFAULT 'PAYSTACK',
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "ussdCode" TEXT;

-- CreateTable
CREATE TABLE "artisan_bank_accounts" (
    "id" TEXT NOT NULL,
    "artisanProfileId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "paystackRecipientCode" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artisan_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artisan_bank_accounts_artisanProfileId_key" ON "artisan_bank_accounts"("artisanProfileId");

-- AddForeignKey
ALTER TABLE "artisan_bank_accounts" ADD CONSTRAINT "artisan_bank_accounts_artisanProfileId_fkey" FOREIGN KEY ("artisanProfileId") REFERENCES "artisan_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
