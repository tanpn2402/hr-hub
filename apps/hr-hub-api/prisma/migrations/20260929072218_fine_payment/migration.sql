-- CreateTable
CREATE TABLE "FinePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT,
    "monthlyFineIds" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "providerMetadata" TEXT,
    "paidAt" DATETIME,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FinePayment_employeeCode_status_idx" ON "FinePayment"("employeeCode", "status");

-- CreateIndex
CREATE INDEX "FinePayment_status_idx" ON "FinePayment"("status");

-- CreateIndex
CREATE INDEX "FinePayment_providerPaymentId_idx" ON "FinePayment"("providerPaymentId");
