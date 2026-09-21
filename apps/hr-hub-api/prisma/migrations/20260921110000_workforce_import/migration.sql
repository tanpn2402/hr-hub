CREATE TABLE "WorkforceImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "attendanceFileName" TEXT NOT NULL,
    "leaveFileName" TEXT NOT NULL,
    "totalAttendance" INTEGER NOT NULL DEFAULT 0,
    "totalLeave" INTEGER NOT NULL DEFAULT 0,
    "totalFine" INTEGER NOT NULL DEFAULT 0,
    "previewData" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "WorkforceImport_status_idx" ON "WorkforceImport"("status");
CREATE INDEX "WorkforceImport_createdAt_idx" ON "WorkforceImport"("createdAt");
