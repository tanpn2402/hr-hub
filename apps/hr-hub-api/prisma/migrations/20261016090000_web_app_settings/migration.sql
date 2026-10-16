-- AlterTable
ALTER TABLE "WebApp" ADD COLUMN "settings" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "WebAppVersion" ADD COLUMN "manifest" TEXT;
