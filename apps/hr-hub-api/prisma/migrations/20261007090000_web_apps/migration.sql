-- CreateTable
CREATE TABLE "WebApp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "requiredRoles" TEXT NOT NULL DEFAULT '[]',
    "currentVersionId" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebAppVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webAppId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "archiveName" TEXT NOT NULL,
    "archiveType" TEXT NOT NULL,
    "archiveSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "note" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebAppVersion_webAppId_fkey" FOREIGN KEY ("webAppId") REFERENCES "WebApp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WebApp_slug_key" ON "WebApp"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WebApp_currentVersionId_key" ON "WebApp"("currentVersionId");

-- CreateIndex
CREATE INDEX "WebApp_status_idx" ON "WebApp"("status");

-- CreateIndex
CREATE INDEX "WebAppVersion_webAppId_status_idx" ON "WebAppVersion"("webAppId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebAppVersion_webAppId_version_key" ON "WebAppVersion"("webAppId", "version");
