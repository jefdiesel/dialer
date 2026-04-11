-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "repliedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "handoffRef" TEXT,
    "handoffAt" DATETIME,
    "step" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Draft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Draft" ("body", "channel", "createdAt", "handoffAt", "handoffRef", "id", "leadId", "model", "status", "subject", "updatedAt") SELECT "body", "channel", "createdAt", "handoffAt", "handoffRef", "id", "leadId", "model", "status", "subject", "updatedAt" FROM "Draft";
DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
CREATE INDEX "Draft_leadId_idx" ON "Draft"("leadId");
CREATE INDEX "Draft_status_dueAt_idx" ON "Draft"("status", "dueAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
