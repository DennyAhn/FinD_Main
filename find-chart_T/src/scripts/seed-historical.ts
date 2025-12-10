/**
 * 과거 1분봉 데이터 시딩 스크립트
 * 
 * TwelveData API를 사용하여 2025년 1월 1일부터 현재까지의
 * 나스닥(QQQ), S&P500(SPY), 다우(DIA), 비트코인(BTC/USD)의 1분봉 데이터를 수집
 * 
 * 사용법:
 *   # 전체 시딩 (SPY, QQQ, DIA, BTC/USD)
 *   npm run seed
 *   # 특정 심볼만
 *   npm run seed:symbol SPY
 *   # 빠르게 1분봉만 (집계 건너뛰기)
 *   npx ts-node src/scripts/seed-historical.ts --skip-agg
 *   # 특정 날짜부터
 *   npx ts-node src/scripts/seed-historical.ts --from 2025-03-01
 */

import axios from 'axios';
import { prisma } from '../shared';
import { candleService, AGG_TIMEFRAMES } from '../modules/candle';
import config from '../config';

// ==================== 설정 ====================

const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'DIA'];
const TARGET_DATE = new Date('2025-01-01').getTime();
const TWELVEDATA_API_URL = 'https://api.twelvedata.com/time_series';

// TwelveData Pro 플랜: 분당 30회, 하루 무제한
// 500ms 간격 = 분당 120회이지만, 안전하게 800ms 정도로 설정
const API_DELAY_MS = 800;

// 한 번에 최대 5000개
const MAX_OUTPUT_SIZE = 5000;

// ==================== 타입 ====================

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface SeedOptions {
  symbols: string[];
  targetDate: Date;
  skipAggregation: boolean;
  category: string;
  endDate?: Date;
}

// ==================== 유틸리티 ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = {
    symbols: DEFAULT_SYMBOLS,
    targetDate: new Date(TARGET_DATE),
    skipAggregation: false,
    category: 'stock',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--symbol':
      case '-s':
        if (next) {
          options.symbols = [next];
          i++;
        }
        break;
      case '--symbols':
        if (next) {
          options.symbols = next.split(',');
          i++;
        }
        break;
      case '--from':
        if (next) {
          options.targetDate = new Date(next);
          i++;
        }
        break;
      case '--to':
        if (next) {
          options.endDate = new Date(next);
          i++;
        }
        break;
      case '--skip-agg':
        options.skipAggregation = true;
        break;
      case '--category':
      case '-c':
        if (next) {
          options.category = next;
          i++;
        }
        break;
      case '--help':
      case '-h':
        console.log(`
과거 1분봉 데이터 시딩 스크립트 (Pro 플랜 최적화)

사용법:
  npx ts-node src/scripts/seed-historical.ts [옵션]

옵션:
  --symbol, -s <심볼>     단일 심볼만 시딩 (예: SPY)
  --symbols <심볼들>      여러 심볼 지정 (쉼표 구분)
  --category, -c <카테고리>  카테고리 (stock, crypto, forex, commodity, metal)
  --from <날짜>           목표 시작 날짜 (기본: 2025-01-01)
  --to <날짜>             목표 종료 날짜 (기본: 현재)
  --skip-agg              상위 타임프레임 집계 건너뛰기
  --help, -h              도움말

예시:
  npm run seed
  npm run seed:symbol BTC/USD
  npx ts-node src/scripts/seed-historical.ts --from 2025-06-01
`);
        process.exit(0);
    }
  }

  return options;
}

// ==================== 심볼별 시딩 ====================

async function seedSymbol(symbol: string, targetDate: Date, category: string, maxDate?: Date): Promise<number> {
  let endDate: string | undefined = maxDate ? maxDate.toISOString() : undefined;
  let totalSaved = 0;
  let requestCount = 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [${symbol}] 시딩 시작 (목표: ${formatDate(targetDate)}까지)`);
  console.log('='.repeat(60));

  while (true) {
    try {
      requestCount++;
      
      const response = await axios.get(TWELVEDATA_API_URL, {
        params: {
          symbol,
          interval: '1min',
          outputsize: MAX_OUTPUT_SIZE,
          apikey: config.TWELVE_DATA_API_KEY,
          end_date: endDate,
          order: 'DESC',
        },
      });

      // API 에러 체크
      if (response.data.status === 'error') {
        const msg = response.data.message;
        
        // Rate limit
        if (response.data.code === 429 || msg?.includes('rate limit')) {
          console.log(`   ⚠️ Rate limit 도달. 30초 대기...`);
          await sleep(30000);
          continue;
        }
        
        console.error(`   ❌ API Error: ${msg}`);
        break;
      }

      const candles: TwelveDataCandle[] = response.data.values;
      
      if (!candles || candles.length === 0) {
        console.log(`   🏁 더 이상 데이터가 없습니다.`);
        break;
      }

      // 유효한 캔들만 필터링
      const validCandles = candles.filter(c =>
        c.datetime && c.open && c.high && c.low && c.close
      );

      if (validCandles.length === 0) {
        console.log(`   🏁 유효한 데이터가 없습니다.`);
        break;
      }

      // DB 저장
      const result = await prisma.candle1m.createMany({
        data: validCandles.map(c => ({
          symbol,
          category,
          time: new Date(c.datetime),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseInt(c.volume) || 0,
        })),
        skipDuplicates: true,
      });

      totalSaved += result.count;
      
      // 가장 오래된 캔들의 시간
      const oldestCandle = validCandles[validCandles.length - 1]!;
      const oldestTime = new Date(oldestCandle.datetime);
      endDate = oldestCandle.datetime;

      console.log(
        `   [${requestCount}] +${result.count.toLocaleString()}개 ` +
        `(누적: ${totalSaved.toLocaleString()}개) → ${formatDate(oldestTime)}`
      );

      // 목표 날짜 도달 체크
      if (oldestTime.getTime() <= targetDate.getTime()) {
        console.log(`   ✅ 목표 날짜 도달!`);
        break;
      }

      // API 호출 간격
      await sleep(API_DELAY_MS);

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.log(`   ⚠️ Rate limit (429). 30초 대기...`);
          await sleep(30000);
          continue;
        }
        console.error(`   ❌ HTTP ${error.response?.status}: ${error.message}`);
      } else {
        console.error(`   ❌ 에러:`, error);
      }
      
      // 에러 시 5초 대기 후 재시도
      await sleep(5000);
    }
  }

  console.log(`\n   📊 [${symbol}] 완료: 총 ${totalSaved.toLocaleString()}개 저장`);
  return totalSaved;
}

// ==================== CA View 갱신 ====================

async function refreshAggregations(symbol: string): Promise<void> {
  console.log(`\n   📈 [${symbol}] TimescaleDB Continuous Aggregates 갱신...`);

  // DB에서 실제 데이터 범위 조회
  const boundary = await prisma.candle1m.aggregate({
    where: { symbol },
    _min: { time: true },
    _max: { time: true },
  });

  if (!boundary._min.time || !boundary._max.time) {
    console.log(`      데이터가 없어 CA 갱신 건너뜀`);
    return;
  }

  // TimescaleDB의 모든 CA View를 한 번에 갱신
  const startTime = Date.now();
  await candleService.refreshAllContinuousAggregates();
  const elapsed = Date.now() - startTime;

  console.log(`      ✅ CA 갱신 완료 (5m, 15m, 1h, 4h, 1d, 1w, 1mo)`);
  console.log(`      ⏱️  소요 시간: ${elapsed}ms`);
}

// ==================== 메인 ====================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n' + '🚀'.repeat(30));
  console.log('📅 과거 데이터 시딩 (Pro 플랜 최적화)');
  console.log('🚀'.repeat(30));
  console.log(`대상: ${options.symbols.join(', ')}`);
  console.log(`카테고리: ${options.category}`);
  console.log(`목표 날짜: ${formatDate(options.targetDate)} 이후 데이터`);
  if (options.endDate) {
    console.log(`종료 날짜: ${formatDate(options.endDate)} 이전 데이터`);
  }
  console.log(`API 호출 간격: ${API_DELAY_MS}ms`);

  const startTime = Date.now();
  const results: Record<string, number> = {};

  // 1. 1분봉 수집
  for (const symbol of options.symbols) {
    results[symbol] = await seedSymbol(symbol, options.targetDate, options.category, options.endDate);
  }

  // 2. TimescaleDB Continuous Aggregates 갱신
  if (!options.skipAggregation) {
    console.log('\n' + '-'.repeat(60));
    console.log('📈 Continuous Aggregates 갱신 시작');
    console.log('-'.repeat(60));

    for (const symbol of options.symbols) {
      if (results[symbol]! > 0) {
        await refreshAggregations(symbol);
      }
    }
  }

  // 3. 완료 통계
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('\n' + '✨'.repeat(30));
  console.log('🎉 시딩 완료!');
  console.log(`⏱️  소요: ${minutes}분 ${seconds}초`);
  console.log('✨'.repeat(30));

  console.log('\n📊 최종 현황:\n');
  for (const symbol of options.symbols) {
    const stats = await prisma.candle1m.aggregate({
      where: { symbol },
      _count: true,
      _min: { time: true },
      _max: { time: true },
    });

    if (stats._count > 0) {
      console.log(`   ${symbol.padEnd(10)} ${stats._count.toLocaleString().padStart(10)}개  (${formatDate(stats._min.time!)} ~ ${formatDate(stats._max.time!)})`);
    }
  }
  console.log('');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 시딩 실패:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
