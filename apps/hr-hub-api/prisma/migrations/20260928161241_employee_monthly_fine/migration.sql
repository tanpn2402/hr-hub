-- CreateTable
CREATE TABLE "EmployeeMonthlyFine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT,
    "month" DATETIME NOT NULL,
    "originalAmount" INTEGER NOT NULL DEFAULT 0,
    "reductionAmount" INTEGER NOT NULL DEFAULT 0,
    "payableAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "paidBy" TEXT,
    "paidByName" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "EmployeeMonthlyFine_month_status_idx" ON "EmployeeMonthlyFine"("month", "status");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyFine_employeeCode_status_idx" ON "EmployeeMonthlyFine"("employeeCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlyFine_employeeCode_month_key" ON "EmployeeMonthlyFine"("employeeCode", "month");
