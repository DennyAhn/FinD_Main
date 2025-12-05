# fin-q-chart-server

## Chart Server Aggregation & API

### 환경 개요
`Candle1m` 테이블에 1분 봉이 저장되고, **TimescaleDB Continuous Aggregates**가 자동으로 상위 타임프레임(5분, 15분, 1시간, 4시간, 1일, 1주, 1개월)을 집계합니다.

**중요:** 애플리케이션은 1분봉만 저장하며, 상위 타임프레임 집계는 DB가 전담합니다. 이를 통해:
- CPU/메모리 부하 최소화
- 데이터 정합성 보장
- Race Condition 방지

### WebSocket 이벤트
클라이언트는 서버 (`/ws`) 에 연결하면 아래 형태 메시지를 수신합니다.

```jsonc
{ "type": "tick", "symbol": "BTC/USD", "price": 100.12, "timestamp": 1731400000 }
{ "type": "candle", "timeframe": "1m", "candle": { "symbol": "BTC/USD", "startTime": 1731400000, "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1234 } }
{ "type": "candle", "timeframe": "5m", "candle": { "symbol": "BTC/USD", "timeframe": 5, "startTime": 1731399700, "open": 98, "high": 102, "low": 97.5, "close": 100.5, "volume": 5555 } }
```

`tick` 는 실시간 체결(가격) 갱신용이고, `candle` 메시지는 봉이 **완성되는 시점** 에 한 번 전송됩니다.

### REST API

1. 최근 봉 조회
```
GET /api/candles/:symbol/:timeframe?limit=500
```
 timeframes: `1m | 5m | 15m | 1h | 4h`

응답:
```jsonc
{
  "symbol": "BTC/USD",
  "timeframe": "15m",
  "data": [ { "time": 1731400000, "open": 100, "high": 103, "low": 99, "close": 101, "volume": 9999 } ]
}
```

2. CA 뷰 수동 새로고침 (백필 후 사용)
```
POST /api/aggregate/refresh
Body: { "timeframe": "5m", "from": 1638316800, "to": 1638403200 }
```

1분봉 데이터를 백필한 후 상위 타임프레임에 즉시 반영하기 위해 사용합니다.
TimescaleDB Continuous Aggregates는 자동 갱신되지만, 백필 후 즉시 반영이 필요할 때 사용하세요.

응답:
```jsonc
{ "success": true, "timeframe": "5m", "message": "Continuous Aggregate 뷰가 새로고침되었습니다." }
```

### 실행 방법
1. `.env` 파일에 `DATABASE_URL`, `TWELVE_DATA_API_KEY`, 필요시 `STREAM_SYMBOLS` 설정.
2. 마이그레이션:
```bash
npx prisma migrate dev --name init
```
3. 개발 서버:
```bash
npm run dev
```

### 서버 구조 요약
- `src/server.ts`: Express + WebSocket 서버, TwelveData 실시간 수신, 봉 생성/브로드캐스트
- `src/modules/candle/candle.maker.ts`: 1분봉 실시간 조립
- `src/modules/candle/candle.buffer.ts`: 배치 저장 버퍼 (Graceful Shutdown, Dead Letter Queue)
- `src/modules/candle/candle.repository.ts`: DB 조회 (CA 뷰 직접 조회)
- `prisma/schema.prisma`: `Candle1m` 모델 (집계 테이블은 제거됨)
- `prisma/migrations/continuous_aggregates.sql`: TimescaleDB CA 뷰 정의

**집계 아키텍처 변경:**
- ❌ 기존: Node.js가 1분봉을 읽어 집계 → CandleAgg 테이블에 저장
- ✅ 현재: TimescaleDB가 자동 집계 → CA 뷰(market.candle_5m 등) 조회만

### 향후 개선 아이디어
- ✅ TimescaleDB Continuous Aggregates 적용 완료
- 심볼별 구독 관리 (클라이언트 -> 특정 심볼만 수신)
- Redis Pub/Sub 또는 Kafka로 수평 확장
- 시장 휴장 캘린더 DB 구축 (공휴일, 서머타임 등)
- 단위/통화 변환 및 지수(나스닥/S&P/Dow) 실시간 feed 확장
- WebSocket Ping/Pong 및 재연결 로직 강화
- 테스트 코드 작성 (Jest + 70% 커버리지 목표)
- 에러 처리 개선 (Prisma 에러 코드 활용)
- 모니터링 (Prometheus metrics + Grafana dashboard)
