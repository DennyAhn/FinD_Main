/**
 * 특정 기간 1분봉 데이터 재수집 스크립트
 * 
 * 기존 데이터를 삭제하고 API에서 다시 가져와 덮어씁니다.
 * OHLC 가격이 잘못된 경우 이 스크립트로 해당 기간을 재수집하세요.
 * 
 * 사용법:
 *   npm run refetch -- --symbol BTC/USD --from 2025-11-26 --to 2025-11-27
 */

import axios from 'axios';
import config from '../config';
import { prisma } from '../shared';
import { candleService } from '../modules/candle';

// ==================== 설정 ====================

const DEFAULT_SYMBOLS = config.STREAM_SYMBOLS;
const API_DELAY_MS = 800; // Pro 플랜
const MAX_OUTPUT_SIZE = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ==================== 타입 ====================

interface RefetchOptions {
  symbols: string[];
  fromDate: Date;
  toDate: Date;
  dryRun: boolean;
}

// ==================== 유틸리티 ====================

const KST_OFFSET = 9 * 60 * 60 * 1000; // 한국 시간 오프셋 (UTC+9)

/**
 * 한국시간 날짜 문자열(YYYY-MM-DD)을 UTC Date로 변환
 * 예: "2025-11-26" -> 한국시간 2025-11-26 00:00:00 = UTC 2025-11-25 15:00:00
 */
function parseKstDate(dateStr: string): Date {
  // 한국시간 00:00:00으로 해석하고 UTC로 변환
  const kstMidnight = new Date(dateStr + 'T00:00:00+09:00');
  return kstMidnight;
}

/**
 * 한국시간 날짜 끝 (다음날 00:00:00 직전 = 23:59:59.999)
 * 예: "2025-11-27" -> 한국시간 2025-11-27 23:59:59.999
 */
function parseKstDateEnd(dateStr: string): Date {
  const kstEndOfDay = new Date(dateStr + 'T23:59:59.999+09:00');
  return kstEndOfDay;
}

function formatDateForApi(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function formatKst(date: Date): string {
  // UTC를 KST로 변환해서 수동 포맷
  const kst = new Date(date.getTime() + KST_OFFSET);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  const s = String(kst.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function parseArgs(): RefetchOptions {
  const args = process.argv.slice(2);
  const options: RefetchOptions = {
    symbols: [],
    fromDate: new Date(),
    toDate: new Date(),
    dryRun: false,
  };

  let hasFrom = false;
  let hasTo = false;
  let hasSymbol = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--symbol':
      case '-s':
        if (next) {
          options.symbols = [next];
          hasSymbol = true;
          i++;
        }
        break;
      case '--symbols':
        if (next) {
          options.symbols = next.split(',');
          hasSymbol = true;
          i++;
        }
        break;
      case '--from':
        if (next) {
          options.fromDate = parseKstDate(next);
          hasFrom = true;
          i++;
        }
        break;
      case '--to':
        if (next) {
          options.toDate = parseKstDateEnd(next);
          hasTo = true;
          i++;
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Refetch Candles - 특정 기간 1분봉 재수집 스크립트

⚠️  주의: 이 스크립트는 기존 데이터를 삭제하고 다시 가져옵니다!

사용법:
  npm run refetch -- --symbol <심볼> --from <시작일> --to <종료일>

필수 옵션:
  --symbol, -s <심볼>     심볼 (예: BTC/USD, SPY)
  --from <날짜>           시작 날짜 (예: 2025-11-26)
  --to <날짜>             종료 날짜 (예: 2025-11-27)

선택 옵션:
  --symbols <심볼들>      여러 심볼 (쉼표 구분)
  --dry-run               실제 삭제/저장 없이 시뮬레이션
  --help, -h              도움말

예시:
  npm run refetch -- --symbol BTC/USD --from 2025-11-26 --to 2025-11-27
  npm run refetch -- --symbols SPY,QQQ --from 2025-11-01 --to 2025-11-30
  npm run refetch -- --symbol BTC/USD --from 2025-11-26 --to 2025-11-27 --dry-run
`);
        process.exit(0);
    }
  }

  // 필수 옵션 체크
  if (!hasSymbol) {
    console.error('❌ --symbol 옵션이 필요합니다.');
    console.error('   예: npm run refetch -- --symbol BTC/USD --from 2025-11-26 --to 2025-11-27');
    process.exit(1);
  }
  if (!hasFrom || !hasTo) {
    console.error('❌ --from과 --to 옵션이 모두 필요합니다.');
    console.error('   예: npm run refetch -- --symbol BTC/USD --from 2025-11-26 --to 2025-11-27');
    process.exit(1);
  }

  return options;
}

// ==================== API 호출 ====================

interface ApiParams {
  symbol: string;
  interval: string;
  apikey: string;
  start_date: string;
  end_date: string | undefined;
  outputsize: number;
  order: string;
}

async function fetchCandles(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const allCandles: any[] = [];
  let currentEnd: string | undefined = formatDateForApi(endDate);

  while (true) {
    const params: ApiParams = {
      symbol,
      interval: '1min',
      apikey: config.TWELVE_DATA_API_KEY,
      start_date: formatDateForApi(startDate),
      end_date: currentEnd,
      outputsize: MAX_OUTPUT_SIZE,
      order: 'DESC',
    };

    try {
      const response = await axios.get('https://api.twelvedata.com/time_series', { params });
      const data = response.data;

      if (data.status === 'error') {
        if (data.code === 429) {
          console.log('   ⚠️ Rate limit, 30초 대기...');
          await sleep(30000);
          continue;
        }
        console.warn(`   API Error: ${data.message}`);
        break;
      }

      const candles: any[] = data.values || [];
      if (candles.length === 0) break;

      allCandles.push(...candles);

      // 가장 오래된 캔들 확인
      const oldestCandle = candles[candles.length - 1]!;
      const oldestTime = new Date(oldestCandle.datetime);

      console.log(`   📥 ${candles.length}개 수신 (→ ${formatDate(oldestTime)})`);

      // 시작일 도달 체크
      if (oldestTime <= startDate) break;

      // 다음 요청 준비
      currentEnd = oldestCandle.datetime;
      await sleep(API_DELAY_MS);

    } catch (err: any) {
      console.error('   요청 실패:', err.message);
      await sleep(2000);
    }
  }

  return allCandles;
}

// ==================== 심볼별 처리 ====================

async function refetchSymbol(
  symbol: string,
  fromDate: Date,
  toDate: Date,
  dryRun: boolean
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 [${symbol}] 재수집 시작`);
  console.log(`   기간 (KST): ${formatKst(fromDate)} ~ ${formatKst(toDate)}`);
  if (dryRun) console.log(`   ⚠️ DRY RUN 모드 (실제 변경 없음)`);
  console.log('='.repeat(60));

  // 1. 기존 데이터 개수 확인
  const existingCount = await prisma.candle1m.count({
    where: {
      symbol,
      time: { gte: fromDate, lte: toDate },
    },
  });
  console.log(`\n📊 기존 데이터: ${existingCount.toLocaleString()}개`);

  // 2. API에서 데이터 가져오기
  console.log(`\n📡 API에서 데이터 수집 중...`);
  const candles = await fetchCandles(symbol, fromDate, toDate);

  if (candles.length === 0) {
    console.log(`   ❌ API에서 데이터를 가져오지 못했습니다.`);
    return;
  }

  console.log(`   ✅ 총 ${candles.length.toLocaleString()}개 수신 완료`);

  if (dryRun) {
    console.log(`\n🔍 [DRY RUN] 실제로 실행하면:`);
    console.log(`   - ${existingCount.toLocaleString()}개 삭제`);
    console.log(`   - ${candles.length.toLocaleString()}개 저장`);
    return;
  }

  // 3. 기존 데이터 삭제
  console.log(`\n🗑️ 기존 데이터 삭제 중...`);
  const deleted = await prisma.candle1m.deleteMany({
    where: {
      symbol,
      time: { gte: fromDate, lte: toDate },
    },
  });
  console.log(`   ✅ ${deleted.count.toLocaleString()}개 삭제 완료`);

  // 4. 새 데이터 저장
  console.log(`\n💾 새 데이터 저장 중...`);
  const batch = candles.map((c: any) => ({
    symbol,
    time: new Date(c.datetime),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseFloat(c.volume || '0'),
  }));

  const result = await prisma.candle1m.createMany({
    data: batch,
    skipDuplicates: true,
  });
  console.log(`   ✅ ${result.count.toLocaleString()}개 저장 완료`);

  // 5. TimescaleDB Continuous Aggregates 새로고침
  // 애플리케이션에서 직접 집계하지 않고, DB에게 뷰 갱신을 요청
  console.log(`\n📈 상위 타임프레임 CA 뷰 새로고침 중...`);
  
  const timeframes = ['5m', '15m', '1h', '4h', '1D', '1W', '1M'];
  
  for (const tf of timeframes) {
    try {
      await candleService.refreshContinuousAggregate(
        tf,
        Math.floor(fromDate.getTime() / 1000),
        Math.floor(toDate.getTime() / 1000) + 86400 // +1일 여유
      );
      console.log(`   ✅ ${tf} 뷰 새로고침 완료`);
    } catch (err: any) {
      console.error(`   ❌ ${tf} 뷰 새로고침 실패:`, err.message);
    }
  }

  console.log(`\n✅ [${symbol}] 재수집 완료!`);
}

// ==================== 메인 ====================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n' + '🔄'.repeat(30));
  console.log('📊 Refetch Candles - 1분봉 재수집');
  console.log('🔄'.repeat(30));
  console.log(`\n대상 심볼: ${options.symbols.join(', ')}`);
  console.log(`기간 (KST): ${formatKst(options.fromDate)} ~ ${formatKst(options.toDate)}`);
  console.log(`기간 (UTC): ${options.fromDate.toISOString()} ~ ${options.toDate.toISOString()}`);
  if (options.dryRun) {
    console.log(`모드: 🔍 DRY RUN (시뮬레이션)`);
  }

  const startTime = Date.now();

  for (const symbol of options.symbols) {
    await refetchSymbol(symbol, options.fromDate, options.toDate, options.dryRun);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '✨'.repeat(30));
  console.log(`🎉 완료! (소요: ${elapsed}초)`);
  console.log('✨'.repeat(30) + '\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 에러:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
