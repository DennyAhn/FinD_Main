-- ============================================================
-- TimescaleDB Continuous Aggregates for Candle Data
-- ============================================================
-- 
-- 이 스크립트는 1분봉(Candle1m)을 기반으로 
-- 5분, 15분, 1시간, 4시간 집계봉을 자동 생성합니다.
--
-- TimescaleDB가 데이터 삽입을 감지하고 자동으로 집계합니다.
-- 애플리케이션에서 집계 로직이 필요 없습니다.
-- ============================================================

-- 1. Candle1m 테이블이 Hypertable인지 확인 (아니면 변환)
-- 주의: 이미 Hypertable이면 에러 발생하므로 IF NOT EXISTS 체크
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'Candle1m'
    ) THEN
        PERFORM create_hypertable('market."Candle1m"', 'time', if_not_exists => TRUE);
        RAISE NOTICE 'Candle1m을 Hypertable로 변환했습니다.';
    ELSE
        RAISE NOTICE 'Candle1m은 이미 Hypertable입니다.';
    END IF;
END $$;

-- ============================================================
-- 5분봉 Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_5m CASCADE;

CREATE MATERIALIZED VIEW market.candle_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

-- 자동 새로고침 정책: 10분마다 실행, 최근 1시간 데이터 갱신
SELECT add_continuous_aggregate_policy('market.candle_5m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE
);

-- 초기 데이터 채우기 (기존 데이터가 있는 경우)
CALL refresh_continuous_aggregate('market.candle_5m', NULL, NULL);

-- 성능 최적화: symbol과 bucket에 대한 복합 인덱스
-- 대시보드 조회 쿼리(WHERE symbol = ? ORDER BY bucket DESC LIMIT 1)를 O(1)로 만듦
CREATE INDEX IF NOT EXISTS idx_candle_5m_symbol_bucket ON market.candle_5m (symbol, bucket DESC);

-- ============================================================
-- 15분봉 Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_15m CASCADE;

CREATE MATERIALIZED VIEW market.candle_15m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

SELECT add_continuous_aggregate_policy('market.candle_15m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE
);

CALL refresh_continuous_aggregate('market.candle_15m', NULL, NULL);

CREATE INDEX IF NOT EXISTS idx_candle_15m_symbol_bucket ON market.candle_15m (symbol, bucket DESC);

-- ============================================================
-- 1시간봉 Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_1h CASCADE;

CREATE MATERIALIZED VIEW market.candle_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

SELECT add_continuous_aggregate_policy('market.candle_1h',
    start_offset => INTERVAL '4 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

CALL refresh_continuous_aggregate('market.candle_1h', NULL, NULL);

CREATE INDEX IF NOT EXISTS idx_candle_1h_symbol_bucket ON market.candle_1h (symbol, bucket DESC);

-- ============================================================
-- 4시간봉 Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_4h CASCADE;

CREATE MATERIALIZED VIEW market.candle_4h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('4 hours', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

SELECT add_continuous_aggregate_policy('market.candle_4h',
    start_offset => INTERVAL '12 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '4 hours',
    if_not_exists => TRUE
);

CALL refresh_continuous_aggregate('market.candle_4h', NULL, NULL);

CREATE INDEX IF NOT EXISTS idx_candle_4h_symbol_bucket ON market.candle_4h (symbol, bucket DESC);

-- ============================================================
-- 일봉(1D) Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_1d CASCADE;

CREATE MATERIALIZED VIEW market.candle_1d
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

-- 일봉은 하루에 한 번 갱신해도 충분하지만, 
-- 실시간성을 위해 1시간마다 갱신
SELECT add_continuous_aggregate_policy('market.candle_1d',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

CALL refresh_continuous_aggregate('market.candle_1d', NULL, NULL);

CREATE INDEX IF NOT EXISTS idx_candle_1d_symbol_bucket ON market.candle_1d (symbol, bucket DESC);

-- ============================================================
-- 주봉(1W) Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_1w CASCADE;

CREATE MATERIALIZED VIEW market.candle_1w
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 week', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

-- 주봉은 일주일에 한 번만 변하므로 하루에 한 번 갱신
-- start_offset은 최소 2개 버킷(2주) 이상이어야 함
SELECT add_continuous_aggregate_policy('market.candle_1w',
    start_offset => INTERVAL '4 weeks',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CALL refresh_continuous_aggregate('market.candle_1w', NULL, NULL);

CREATE INDEX IF NOT EXISTS idx_candle_1w_symbol_bucket ON market.candle_1w (symbol, bucket DESC);

-- ============================================================
-- 월봉(1M) Continuous Aggregate
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS market.candle_1mo CASCADE;

CREATE MATERIALIZED VIEW market.candle_1mo
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', time) AS bucket,
    symbol,
    category,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM market."Candle1m"
GROUP BY bucket, symbol, category
WITH NO DATA;

-- 월봉은 일주일에 한 번 갱신해도 충분
-- start_offset은 최소 2개 버킷(2달) 이상이어야 함
SELECT add_continuous_aggregate_policy('market.candle_1mo',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

CALL refresh_continuous_aggregate('market.candle_1mo', NULL, NULL);

CREATE INDEX IF NOT EXISTS idx_candle_1mo_symbol_bucket ON market.candle_1mo (symbol, bucket DESC);

-- ============================================================
-- 확인용 쿼리
-- ============================================================

-- Continuous Aggregate 목록 확인
SELECT 
    view_name,
    materialization_hypertable_name,
    view_definition
FROM timescaledb_information.continuous_aggregates
WHERE view_schema = 'market';

-- 정책 확인
SELECT * FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_refresh_continuous_aggregate';

-- ============================================================
-- 사용 예시
-- ============================================================
-- 
-- 5분봉 조회:
-- SELECT * FROM market.candle_5m 
-- WHERE symbol = 'BTC/USD' 
-- ORDER BY bucket DESC 
-- LIMIT 100;
--
-- 1시간봉 조회:
-- SELECT * FROM market.candle_1h 
-- WHERE symbol = 'QQQ' 
-- ORDER BY bucket DESC 
-- LIMIT 100;
-- ============================================================
