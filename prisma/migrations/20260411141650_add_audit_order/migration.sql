-- CreateTable
CREATE TABLE "AuditOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntent" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "businessName" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 40000,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ndaAcceptedAt" DATETIME,
    "ndaIp" TEXT,
    "uploadedAt" DATETIME,
    "uploadedFiles" TEXT,
    "notes" TEXT,
    "paidAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditOrder_stripeSessionId_key" ON "AuditOrder"("stripeSessionId");

-- CreateIndex
CREATE INDEX "AuditOrder_status_idx" ON "AuditOrder"("status");

-- CreateIndex
CREATE INDEX "AuditOrder_customerEmail_idx" ON "AuditOrder"("customerEmail");
