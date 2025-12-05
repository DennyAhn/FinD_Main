/**
 * EC2 TimescaleDB 직접 세팅 스크립트
 * Prisma migrate를 우회하고 직접 SQL을 실행합니다.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 EC2 TimescaleDB 직접 세팅 시작...\n');

  try {
    // ==================== 1. 초기화 ====================
    console.log('1️⃣ 기존 스키마/테이블 정리...');
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS market CASCADE');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS public."_prisma_migrations" CASCADE');
    console.log('   ✅ 정리 완료\n');

    // ==================== 2. 스키마 생성 ====================
    console.log('2️⃣ market 스키마 생성...');
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS market');
    console.log('   ✅ market 스키마 생성 완료\n');

    // ==================== 3. TimescaleDB 확장 ====================
    console.log('3️⃣ TimescaleDB 확장 활성화...');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
    console.log('   ✅ TimescaleDB 확장 활성화 완료\n');

    // ==================== 4. 테이블 생성 ====================
    console.log('4️⃣ 테이블 생성...');

    // Candle1m
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."Candle1m" (
        "time" TIMESTAMPTZ NOT NULL,
        "symbol" VARCHAR(20) NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'stock',
        "open" DOUBLE PRECISION NOT NULL,
        "high" DOUBLE PRECISION NOT NULL,
        "low" DOUBLE PRECISION NOT NULL,
        "close" DOUBLE PRECISION NOT NULL,
        "volume" DOUBLE PRECISION NOT NULL,
        CONSTRAINT "Candle1m_pkey" PRIMARY KEY ("time","symbol")
      )
    `);
    console.log('   - Candle1m ✅');

    // CandleAgg
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."CandleAgg" (
        "startTime" TIMESTAMPTZ NOT NULL,
        "symbol" VARCHAR(20) NOT NULL,
        "timeframe" INTEGER NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'stock',
        "open" DOUBLE PRECISION NOT NULL,
        "high" DOUBLE PRECISION NOT NULL,
        "low" DOUBLE PRECISION NOT NULL,
        "close" DOUBLE PRECISION NOT NULL,
        "volume" DOUBLE PRECISION NOT NULL,
        CONSTRAINT "CandleAgg_pkey" PRIMARY KEY ("startTime","symbol","timeframe")
      )
    `);
    console.log('   - CandleAgg ✅');

    // CandleDaily
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."CandleDaily" (
        "time" DATE NOT NULL,
        "symbol" VARCHAR(20) NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'stock',
        "open" DOUBLE PRECISION NOT NULL,
        "high" DOUBLE PRECISION NOT NULL,
        "low" DOUBLE PRECISION NOT NULL,
        "close" DOUBLE PRECISION NOT NULL,
        "volume" DOUBLE PRECISION NOT NULL,
        CONSTRAINT "CandleDaily_pkey" PRIMARY KEY ("time","symbol")
      )
    `);
    console.log('   - CandleDaily ✅');

    // CandleWeekly
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."CandleWeekly" (
        "time" DATE NOT NULL,
        "symbol" VARCHAR(20) NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'stock',
        "open" DOUBLE PRECISION NOT NULL,
        "high" DOUBLE PRECISION NOT NULL,
        "low" DOUBLE PRECISION NOT NULL,
        "close" DOUBLE PRECISION NOT NULL,
        "volume" DOUBLE PRECISION NOT NULL,
        CONSTRAINT "CandleWeekly_pkey" PRIMARY KEY ("time","symbol")
      )
    `);
    console.log('   - CandleWeekly ✅');

    // CandleMonthly
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."CandleMonthly" (
        "time" DATE NOT NULL,
        "symbol" VARCHAR(20) NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'stock',
        "open" DOUBLE PRECISION NOT NULL,
        "high" DOUBLE PRECISION NOT NULL,
        "low" DOUBLE PRECISION NOT NULL,
        "close" DOUBLE PRECISION NOT NULL,
        "volume" DOUBLE PRECISION NOT NULL,
        CONSTRAINT "CandleMonthly_pkey" PRIMARY KEY ("time","symbol")
      )
    `);
    console.log('   - CandleMonthly ✅');

    // User
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."User" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_email_key" ON market."User"("email")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "User_email_idx" ON market."User"("email")`);
    console.log('   - User ✅');

    // Alert
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."Alert" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "symbol" VARCHAR(20) NOT NULL,
        "type" VARCHAR(20) NOT NULL,
        "condition" VARCHAR(20) NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "indicator" VARCHAR(20),
        "indicatorParams" JSONB,
        "timeframe" VARCHAR(10),
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "triggeredAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Alert_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES market."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX "Alert_userId_status_idx" ON market."Alert"("userId", "status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "Alert_symbol_type_status_idx" ON market."Alert"("symbol", "type", "status")`);
    console.log('   - Alert ✅');

    // DeadLetter
    await prisma.$executeRawUnsafe(`
      CREATE TABLE market."DeadLetter" (
        "id" TEXT NOT NULL,
        "module" VARCHAR(50) NOT NULL,
        "action" VARCHAR(50) NOT NULL,
        "data" JSONB NOT NULL,
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DeadLetter_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX "DeadLetter_module_createdAt_idx" ON market."DeadLetter"("module", "createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "DeadLetter_createdAt_idx" ON market."DeadLetter"("createdAt")`);
    console.log('   - DeadLetter ✅');

    // 인덱스 추가
    await prisma.$executeRawUnsafe(`CREATE INDEX "Candle1m_category_idx" ON market."Candle1m"("category")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleAgg_symbol_timeframe_startTime_idx" ON market."CandleAgg"("symbol", "timeframe", "startTime")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleAgg_category_idx" ON market."CandleAgg"("category")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleDaily_symbol_time_idx" ON market."CandleDaily"("symbol", "time")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleDaily_category_idx" ON market."CandleDaily"("category")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleWeekly_symbol_time_idx" ON market."CandleWeekly"("symbol", "time")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleWeekly_category_idx" ON market."CandleWeekly"("category")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleMonthly_symbol_time_idx" ON market."CandleMonthly"("symbol", "time")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX "CandleMonthly_category_idx" ON market."CandleMonthly"("category")`);
    console.log('   - 인덱스 생성 ✅\n');

    // ==================== 5. Hypertable 변환 ====================
    console.log('5️⃣ Hypertable 변환...');
    
    await prisma.$executeRawUnsafe(`
      SELECT public.create_hypertable(
        'market."Candle1m"', 'time',
        migrate_data => true,
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => true
      )
    `);
    console.log('   - Candle1m -> Hypertable ✅');

    await prisma.$executeRawUnsafe(`
      SELECT public.create_hypertable(
        'market."CandleAgg"', 'startTime',
        migrate_data => true,
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists => true
      )
    `);
    console.log('   - CandleAgg -> Hypertable ✅');

    await prisma.$executeRawUnsafe(`
      SELECT public.create_hypertable(
        'market."CandleDaily"', 'time',
        migrate_data => true,
        chunk_time_interval => INTERVAL '1 year',
        if_not_exists => true
      )
    `);
    console.log('   - CandleDaily -> Hypertable ✅');

    await prisma.$executeRawUnsafe(`
      SELECT public.create_hypertable(
        'market."CandleWeekly"', 'time',
        migrate_data => true,
        chunk_time_interval => INTERVAL '2 years',
        if_not_exists => true
      )
    `);
    console.log('   - CandleWeekly -> Hypertable ✅');

    await prisma.$executeRawUnsafe(`
      SELECT public.create_hypertable(
        'market."CandleMonthly"', 'time',
        migrate_data => true,
        chunk_time_interval => INTERVAL '5 years',
        if_not_exists => true
      )
    `);
    console.log('   - CandleMonthly -> Hypertable ✅\n');

    // ==================== 6. 압축 정책 ====================
    console.log('6️⃣ 압축 정책 설정...');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE market."Candle1m" SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'symbol,category'
      )
    `);
    await prisma.$executeRawUnsafe(`SELECT public.add_compression_policy('market."Candle1m"', INTERVAL '7 days', if_not_exists => true)`);
    console.log('   - Candle1m 압축 정책 ✅');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE market."CandleAgg" SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'symbol,category,timeframe'
      )
    `);
    await prisma.$executeRawUnsafe(`SELECT public.add_compression_policy('market."CandleAgg"', INTERVAL '30 days', if_not_exists => true)`);
    console.log('   - CandleAgg 압축 정책 ✅');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE market."CandleDaily" SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'symbol,category'
      )
    `);
    await prisma.$executeRawUnsafe(`SELECT public.add_compression_policy('market."CandleDaily"', INTERVAL '1 year', if_not_exists => true)`);
    console.log('   - CandleDaily 압축 정책 ✅\n');

    // ==================== 7. Continuous Aggregates ====================
    console.log('7️⃣ Continuous Aggregates 생성...');

    // 5분봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_5m CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_5m
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('5 minutes', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_5m',
        start_offset => INTERVAL '1 hour',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '5 minutes',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_5m_symbol_bucket ON market.candle_5m (symbol, bucket DESC)`);
    console.log('   - candle_5m ✅');

    // 15분봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_15m CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_15m
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('15 minutes', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_15m',
        start_offset => INTERVAL '2 hours',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '15 minutes',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_15m_symbol_bucket ON market.candle_15m (symbol, bucket DESC)`);
    console.log('   - candle_15m ✅');

    // 1시간봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_1h CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_1h
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('1 hour', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_1h',
        start_offset => INTERVAL '4 hours',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_1h_symbol_bucket ON market.candle_1h (symbol, bucket DESC)`);
    console.log('   - candle_1h ✅');

    // 4시간봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_4h CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_4h
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('4 hours', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_4h',
        start_offset => INTERVAL '12 hours',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '4 hours',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_4h_symbol_bucket ON market.candle_4h (symbol, bucket DESC)`);
    console.log('   - candle_4h ✅');

    // 일봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_1d CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_1d
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('1 day', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_1d',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_1d_symbol_bucket ON market.candle_1d (symbol, bucket DESC)`);
    console.log('   - candle_1d ✅');

    // 주봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_1w CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_1w
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('1 week', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_1w',
        start_offset => INTERVAL '4 weeks',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_1w_symbol_bucket ON market.candle_1w (symbol, bucket DESC)`);
    console.log('   - candle_1w ✅');

    // 월봉
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS market.candle_1mo CASCADE`);
    await prisma.$executeRawUnsafe(`
      CREATE MATERIALIZED VIEW market.candle_1mo
      WITH (timescaledb.continuous) AS
      SELECT
        public.time_bucket('1 month', time) AS bucket,
        symbol,
        category,
        public.first(open, time) AS open,
        max(high) AS high,
        min(low) AS low,
        public.last(close, time) AS close,
        sum(volume) AS volume
      FROM market."Candle1m"
      GROUP BY bucket, symbol, category
      WITH NO DATA
    `);
    await prisma.$executeRawUnsafe(`
      SELECT public.add_continuous_aggregate_policy('market.candle_1mo',
        start_offset => INTERVAL '3 months',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 week',
        if_not_exists => TRUE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_candle_1mo_symbol_bucket ON market.candle_1mo (symbol, bucket DESC)`);
    console.log('   - candle_1mo ✅\n');

    // ==================== 완료 ====================
    console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨');
    console.log('🎉 EC2 TimescaleDB 세팅 완료!');
    console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨\n');

    // 확인
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'market'
    `;
    console.log('📋 생성된 테이블:', tables.map(t => t.tablename).join(', '));

    const hypertables = await prisma.$queryRaw<Array<{ hypertable_name: string }>>`
      SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_schema = 'market'
    `;
    console.log('📋 Hypertables:', hypertables.map(h => h.hypertable_name).join(', '));

    const caggs = await prisma.$queryRaw<Array<{ view_name: string }>>`
      SELECT view_name FROM timescaledb_information.continuous_aggregates WHERE view_schema = 'market'
    `;
    console.log('📋 Continuous Aggregates:', caggs.map(c => c.view_name).join(', '));

  } catch (error) {
    console.error('❌ 에러 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
