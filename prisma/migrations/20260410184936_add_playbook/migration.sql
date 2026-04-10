-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "industrySlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "top3UseCases" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "researchTranscript" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Playbook_industrySlug_key" ON "Playbook"("industrySlug");

-- CreateIndex
CREATE INDEX "Playbook_status_idx" ON "Playbook"("status");
