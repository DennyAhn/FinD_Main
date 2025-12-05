import axios from 'axios';
import config from '../config';
import { prisma } from '../shared';
import { logger } from '../shared/utils/logger';
import { twelveDataLimiter } from '../shared/utils/rate-limiter';

// ==================== 설정 ====================

const DEFAULT_SYMBOLS = config.STREAM_SYMBOLS;
const DEFAULT_FROM_DATE = new Date('2025-01-01');

// ==================== 타입 ====================

interface FillGapsOptions {
  symbols: string[];
  fromDate: Date;
  toDate: Date;
}

interface GapRecord {
  gapStart: Date;
  gapEnd: Date;
  missingMinutes: number;
}

// ==================== 유틸리티 ====================

function formatDateForApi(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function parseArgs(): FillGapsOptions {
  const args = process.argv.slice(2);
  const options: FillGapsOptions = {
    symbols: DEFAULT_SYMBOLS,
    fromDate: DEFAULT_FROM_DATE,
    toDate: new Date(),
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
          options.fromDate = new Date(next);
          i++;
        }
        break;
      case '--to':
        if (next) {
          options.toDate = new Date(next);
          i++;
        }
        break;
      case '--help':
      case '-h':
        console.log(`Usage: npm run fill-gaps -- --symbol SPY`);
        process.exit(0);
    }
  }
  return options;
}

function getCategoryFromSymbol(symbol: string): string {
  if (symbol.includes('BTC') || symbol.includes('ETH')) return 'crypto';
  if (['XAU', 'XAG', 'XPT', 'XPD'].some(m => symbol.includes(m))) return 'metal';
  if (['USO', 'UNG', 'CL', 'NG', 'CPER'].some(e => symbol.includes(e))) return 'commodity';
  if (symbol.includes('/')) return 'forex';
  return 'stock';
}

/**
 * 주말/휴장 갭인지 확인 (로직 강화됨)
 */
function isIgnorableGap(gapStart: Date, gapEnd: Date, symbol: string): boolean {
  const category = getCategoryFromSymbol(symbol);
  if (category === 'crypto') return false; // 크립토는 365일 24시간
  
  const diffHours = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60);
  if (diffHours > 96) return false; 

  const startDay = gapStart.getUTCDay(); // 0=일, 5=금, 6=토

  // 1. 주말 (금요일 오후 ~ 월요일 오전)
  // 금요일에 시작했고, 40시간 이상이지만 96시간(4일) 이하면 주말 휴장으로 간주
  if (startDay === 5 && diffHours > 40) return true; 
  
  // 토/일요일에 시작된 갭은 주말 휴장 (단, 96시간 이내)
  if (startDay === 6 || startDay === 0) return true;

  // 2. 평일 야간 (장 마감 ~ 다음날 개장, 약 15시간)
  // 10시간 ~ 24시간 사이의 갭은 평일 야간 휴장으로 간주
  if (diffHours > 10 && diffHours < 24) return true;

  return false;
}

async function processSymbol(symbol: string, fromDate: Date, toDate: Date) {
  logger.info(`🔍 [${symbol}] 갭 분석 시작`, { from: fromDate.toISOString(), to: toDate.toISOString() });

  // 1. DB에서 갭 탐지
  // 데이터가 아예 없는 경우(첫 시딩 전)는 이 쿼리로 탐지되지 않음 -> seed 스크립트 사용 권장
  const gaps = await prisma.$queryRaw<GapRecord[]>`
    SELECT 
      time AS "gapStart", 
      COALESCE(next_time, ${toDate}::timestamptz) AS "gapEnd",
      EXTRACT(EPOCH FROM (COALESCE(next_time, ${toDate}::timestamptz) - time)) / 60 AS "missingMinutes"
    FROM (
      SELECT time, LEAD(time) OVER (ORDER BY time ASC) AS next_time
      FROM market."Candle1m"
      WHERE symbol = ${symbol}
        AND time >= ${fromDate}
    ) t
    WHERE COALESCE(next_time, ${toDate}::timestamptz) - time > interval '2 minutes'
    ORDER BY time ASC
  `;

  // 실제로 복구해야 할 갭만 필터링
  const realGaps = gaps.filter((gap) => 
    !isIgnorableGap(new Date(gap.gapStart), new Date(gap.gapEnd), symbol)
  );

  logger.info(`📊 [${symbol}] 발견된 갭: ${gaps.length}개 / 복구 대상: ${realGaps.length}개`);

  if (realGaps.length === 0) return;

  let totalRecovered = 0;
  const category = getCategoryFromSymbol(symbol);

  // 2. 각 갭에 대해 데이터 수집
  for (const gap of realGaps) {
    let currentFetchStart = new Date(new Date(gap.gapStart).getTime() + 60000); // 갭 시작 + 1분
    const gapEnd = new Date(gap.gapEnd);
    
    // 갭이 완전히 채워질 때까지 반복 (대형 갭 대응)
    while (currentFetchStart < gapEnd) {
      logger.info(`   ⏳ Fetching: ${formatDateForApi(currentFetchStart)} ~ (Gap End: ${formatDateForApi(gapEnd)})`);

      try {
        const response = await twelveDataLimiter.schedule(() => 
          axios.get('https://api.twelvedata.com/time_series', {
            params: {
              symbol,
              interval: '1min',
              timezone: 'UTC', // 🔥 필수: 이거 없으면 시간 밀림
              apikey: config.TWELVE_DATA_API_KEY,
              start_date: formatDateForApi(currentFetchStart),
              end_date: formatDateForApi(gapEnd),
              outputsize: 5000, // 최대치
              order: 'ASC',
            },
          })
        );

        if (response.data.status === 'error') {
            // 데이터가 없는 구간(예: 공휴일)일 수 있음
            if (response.data.code === 400 && response.data.message.includes('no data')) {
                 logger.warn(`      ℹ️ 해당 구간 데이터 없음 (스킵)`);
                 break; // 이 갭은 포기하고 다음 갭으로
            }
            logger.error(`      ❌ API Error: ${response.data.message}`);
            break;
        }

        const candles = response.data.values;
        if (!candles || candles.length === 0) {
          logger.info(`      ℹ️ 데이터 없음 (휴장 등)`);
          break;
        }

        // DB 저장
        const result = await prisma.candle1m.createMany({
          data: candles.map((c: any) => ({
            symbol,
            // 🔥 'Z'를 붙여서 명시적으로 UTC로 해석하게 함 (API가 UTC로 줬다고 가정)
            time: new Date(c.datetime + (c.datetime.endsWith('Z') ? '' : 'Z')),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            volume: parseInt(c.volume) || 0,
            category,
          })),
          skipDuplicates: true,
        });

        totalRecovered += result.count;
        logger.info(`      ✅ 저장됨: ${result.count}개`);

        // 다음 루프 준비: 받아온 마지막 데이터의 다음 시간부터
        const lastCandleTime = new Date(candles[candles.length - 1].datetime + 'Z');
        currentFetchStart = new Date(lastCandleTime.getTime() + 60000);
        
        // 무한 루프 방지: API가 계속 같은 데이터를 주거나 진전이 없으면 중단
        if (result.count < 10 && currentFetchStart < gapEnd) {
             logger.warn('      ⚠️ 데이터 부족으로 루프 조기 종료');
             break;
        }

      } catch (error) {
        logger.error(`      ❌ 요청 실패`, { error });
        break;
      }
    }
  }

  logger.info(`🎉 [${symbol}] 최종 ${totalRecovered}개 캔들 복구 완료.`);
}

async function refreshContinuousAggregates(fromDate: Date, toDate: Date): Promise<void> {
  // 뷰 이름과 해당 뷰의 버킷 크기 매핑
  const views: Record<string, string> = {
    'market.candle_5m': '5 minutes',
    'market.candle_15m': '15 minutes',
    'market.candle_1h': '1 hour',
    'market.candle_4h': '4 hours',
    'market.candle_1d': '1 day',
    'market.candle_1w': '1 week',
    'market.candle_1mo': '1 month',
  };

  logger.info('\n🔄 Continuous Aggregates 뷰 갱신 중...');

  for (const [view, interval] of Object.entries(views)) {
    try {
      // [핵심 수정] time_bucket을 사용하여 입력된 날짜를 버킷 단위로 정렬 및 확장
      // 예: 12월 2일을 넣어도 1주일('1 week') 버킷이면 그 주의 월요일로 자동 변환됨.
      // window_end는 start + interval을 더해서 최소 1버킷 이상을 커버하도록 보장.
      
      await prisma.$executeRawUnsafe(
        `CALL public.refresh_continuous_aggregate(
          '${view}'::regclass, 
          public.time_bucket('${interval}', '${fromDate.toISOString()}'::timestamptz), 
          public.time_bucket('${interval}', '${toDate.toISOString()}'::timestamptz) + INTERVAL '${interval}'
        )`
      );
      logger.info(`   ✅ ${view} 갱신 완료`);
    } catch (error: any) {
      // 에러 로그를 더 명확하게 (중복 실행 에러 등은 경고 처리 가능)
      logger.error(`   ❌ ${view} 갱신 실패`, { 
        error: error.message,
        hint: '기간이 너무 짧거나 DB 정책과 충돌했을 수 있습니다.'
      });
    }
  }
}

async function main() {
  const options = parseArgs();

  logger.info('\n' + '🔧'.repeat(30));
  logger.info('📊 Gap Filler - 1분봉 누락 데이터 복구');
  logger.info(`기간: ${options.fromDate.toISOString()} ~ ${options.toDate.toISOString()}`);
  logger.info('🔧'.repeat(30) + '\n');

  const startTime = Date.now();

  // 1. 갭 채우기 실행
  for (const symbol of options.symbols) {
    await processSymbol(symbol, options.fromDate, options.toDate);
  }

  // 2. [추가됨] CA 뷰 강제 갱신
  // 갭을 채운 후 상위 타임프레임(5분, 1시간 등)에도 반영되도록 함
  await refreshContinuousAggregates(options.fromDate, options.toDate);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.info('\n' + '✨'.repeat(30));
  logger.info(`🎉 모든 작업 완료! (소요: ${elapsed}초)`);
  logger.info('✨'.repeat(30) + '\n');

  await prisma.$disconnect();
}

main();