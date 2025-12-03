-- AlterTable
ALTER TABLE "Candle1m" ADD COLUMN     "category" VARCHAR(20) NOT NULL DEFAULT 'stock';

-- AlterTable
ALTER TABLE "CandleAgg" ADD COLUMN     "category" VARCHAR(20) NOT NULL DEFAULT 'stock';

-- AlterTable
ALTER TABLE "CandleDaily" ADD COLUMN     "category" VARCHAR(20) NOT NULL DEFAULT 'stock';

-- AlterTable
ALTER TABLE "CandleMonthly" ADD COLUMN     "category" VARCHAR(20) NOT NULL DEFAULT 'stock';

-- AlterTable
ALTER TABLE "CandleWeekly" ADD COLUMN     "category" VARCHAR(20) NOT NULL DEFAULT 'stock';

-- CreateIndex
CREATE INDEX "Candle1m_category_idx" ON "Candle1m"("category");

-- CreateIndex
CREATE INDEX "CandleAgg_category_idx" ON "CandleAgg"("category");

-- CreateIndex
CREATE INDEX "CandleDaily_category_idx" ON "CandleDaily"("category");

-- CreateIndex
CREATE INDEX "CandleMonthly_category_idx" ON "CandleMonthly"("category");

-- CreateIndex
CREATE INDEX "CandleWeekly_category_idx" ON "CandleWeekly"("category");
