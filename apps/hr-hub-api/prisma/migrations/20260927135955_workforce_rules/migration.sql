-- CreateTable
CREATE TABLE "WorkforceRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'OVERRIDE',
    "property" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "employeeCode" TEXT,
    "weekday" INTEGER,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WorkforceRule_employeeCode_enabled_idx" ON "WorkforceRule"("employeeCode", "enabled");

-- CreateIndex
CREATE INDEX "WorkforceRule_startDate_endDate_enabled_idx" ON "WorkforceRule"("startDate", "endDate", "enabled");

-- CreateIndex
CREATE INDEX "WorkforceRule_property_enabled_idx" ON "WorkforceRule"("property", "enabled");
