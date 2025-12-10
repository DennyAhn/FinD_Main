-- TimescaleDB 확장 활성화
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ==================== Hypertable 변환 ====================
-- migrate_data => true: 기존 데이터 유지하면서 변환
-- chunk_time_interval: 청크 크기 (시간 기반 파티셔닝)

-- 1분봉: 1일 단위 청크 (고빈도 데이터)
SELECT public.create_hypertable(
  'market."Candle1m"', 
  'time',
  migrate_data => true,
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => true
);

-- 집계봉: 7일 단위 청크
SELECT public.create_hypertable(
  'market."CandleAgg"', 
  'startTime',
  migrate_data => true,
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => true
);

-- 일봉: 1년 단위 청크
SELECT public.create_hypertable(
  'market."CandleDaily"', 
  'time',
  migrate_data => true,
  chunk_time_interval => INTERVAL '1 year',
  if_not_exists => true
);

-- 주봉: 2년 단위 청크
SELECT public.create_hypertable(
  'market."CandleWeekly"', 
  'time',
  migrate_data => true,
  chunk_time_interval => INTERVAL '2 years',
  if_not_exists => true
);

-- 월봉: 5년 단위 청크
SELECT public.create_hypertable(
  'market."CandleMonthly"', 
  'time',
  migrate_data => true,
  chunk_time_interval => INTERVAL '5 years',
  if_not_exists => true
);

-- ==================== 압축 정책 (선택사항) ====================
-- 오래된 데이터 자동 압축으로 스토리지 절약

-- 1분봉: 7일 이상 된 데이터 압축
ALTER TABLE market."Candle1m" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol,category'
);
SELECT public.add_compression_policy('market."Candle1m"', INTERVAL '7 days', if_not_exists => true);

-- 집계봉: 30일 이상 된 데이터 압축
ALTER TABLE market."CandleAgg" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol,category,timeframe'
);
SELECT public.add_compression_policy('market."CandleAgg"', INTERVAL '30 days', if_not_exists => true);

-- 일봉: 1년 이상 된 데이터 압축
ALTER TABLE market."CandleDaily" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol,category'
);
SELECT public.add_compression_policy('market."CandleDaily"', INTERVAL '1 year', if_not_exists => true);

-- ==================== 청크 정보 확인 ====================
-- SELECT * FROM timescaledb_information.hypertables;
-- SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'Candle1m';
