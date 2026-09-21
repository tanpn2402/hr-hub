-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT,
    "date" DATETIME NOT NULL,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "adjustedAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FineFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fineId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reductionAmount" INTEGER,
    "reviewedBy" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "referenceId" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "category" TEXT,
    "description" TEXT,
    "provider" TEXT,
    "providerMetadata" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Attendance_employeeCode_date_idx" ON "Attendance"("employeeCode", "date");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Leave_employeeCode_date_idx" ON "Leave"("employeeCode", "date");

-- CreateIndex
CREATE INDEX "Leave_employeeCode_status_idx" ON "Leave"("employeeCode", "status");

-- CreateIndex
CREATE INDEX "Leave_date_idx" ON "Leave"("date");

-- CreateIndex
CREATE INDEX "Fine_employeeCode_date_idx" ON "Fine"("employeeCode", "date");

-- CreateIndex
CREATE INDEX "Fine_employeeCode_status_idx" ON "Fine"("employeeCode", "status");

-- CreateIndex
CREATE INDEX "Fine_date_idx" ON "Fine"("date");

-- CreateIndex
CREATE INDEX "FineFeedback_fineId_idx" ON "FineFeedback"("fineId");

-- CreateIndex
CREATE INDEX "FineFeedback_employeeCode_status_idx" ON "FineFeedback"("employeeCode", "status");

-- CreateIndex
CREATE INDEX "FinancialTransaction_referenceId_idx" ON "FinancialTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_type_referenceId_idx" ON "FinancialTransaction"("type", "referenceId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_status_idx" ON "FinancialTransaction"("status");

-- CreateIndex
CREATE INDEX "FinancialTransaction_transactionDate_idx" ON "FinancialTransaction"("transactionDate");
