-- CreateTable
CREATE TABLE "DeadLetter" (
    "id" TEXT NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "data" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeadLetter_module_createdAt_idx" ON "DeadLetter"("module", "createdAt");

-- CreateIndex
CREATE INDEX "DeadLetter_createdAt_idx" ON "DeadLetter"("createdAt");