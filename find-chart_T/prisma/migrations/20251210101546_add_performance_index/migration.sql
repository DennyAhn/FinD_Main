/*
  Warnings:

  - You are about to drop the `CandleAgg` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CandleDaily` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CandleMonthly` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CandleWeekly` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Candle1m_time_idx";

-- DropTable
DROP TABLE "CandleAgg";

-- DropTable
DROP TABLE "CandleDaily";

-- DropTable
DROP TABLE "CandleMonthly";

-- DropTable
DROP TABLE "CandleWeekly";

-- CreateIndex
CREATE INDEX "Candle1m_symbol_time_idx" ON "Candle1m"("symbol", "time" DESC);
