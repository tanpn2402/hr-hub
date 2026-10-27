-- CreateTable
CREATE TABLE "WebAppAccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webAppId" TEXT NOT NULL,
    "appSlug" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterUsername" TEXT,
    "requesterEmail" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "requiredRoles" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedBy" TEXT,
    "decidedByName" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WebAppAccessRequest_status_requestedAt_idx" ON "WebAppAccessRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "WebAppAccessRequest_requesterId_status_idx" ON "WebAppAccessRequest"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebAppAccessRequest_appSlug_requesterId_key" ON "WebAppAccessRequest"("appSlug", "requesterId");
