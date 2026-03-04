/*
  Warnings:

  - You are about to drop the `TransactionAttachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TransactionAttachment" DROP CONSTRAINT "TransactionAttachment_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionAttachment" DROP CONSTRAINT "TransactionAttachment_uploadedById_fkey";

-- DropTable
DROP TABLE "TransactionAttachment";

-- CreateTable
CREATE TABLE "transaction_attachment" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_attachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transaction_attachment" ADD CONSTRAINT "transaction_attachment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachment" ADD CONSTRAINT "transaction_attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
