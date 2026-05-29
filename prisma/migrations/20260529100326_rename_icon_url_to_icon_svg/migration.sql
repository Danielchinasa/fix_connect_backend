/*
  Warnings:

  - You are about to drop the column `iconUrl` on the `service_categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "service_categories" DROP COLUMN "iconUrl",
ADD COLUMN     "iconSvg" TEXT;
