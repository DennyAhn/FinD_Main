-- CreateTable
CREATE TABLE "CandleAgg" (
    "startTime" TIMESTAMPTZ NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "timeframe" INTEGER NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CandleAgg_pkey" PRIMARY KEY ("startTime","symbol","timeframe")
);

-- CreateTable
CREATE TABLE "CandleDaily" (
    "time" DATE NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CandleDaily_pkey" PRIMARY KEY ("time","symbol")
);

-- CreateTable
CREATE TABLE "CandleWeekly" (
    "time" DATE NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CandleWeekly_pkey" PRIMARY KEY ("time","symbol")
);

-- CreateTable
CREATE TABLE "CandleMonthly" (
    "time" DATE NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CandleMonthly_pkey" PRIMARY KEY ("time","symbol")
);

-- CreateIndex
CREATE INDEX "CandleAgg_symbol_timeframe_startTime_idx" ON "CandleAgg"("symbol", "timeframe", "startTime");

-- CreateIndex
CREATE INDEX "CandleDaily_symbol_time_idx" ON "CandleDaily"("symbol", "time");

-- CreateIndex
CREATE INDEX "CandleWeekly_symbol_time_idx" ON "CandleWeekly"("symbol", "time");

-- CreateIndex
CREATE INDEX "CandleMonthly_symbol_time_idx" ON "CandleMonthly"("symbol", "time");
