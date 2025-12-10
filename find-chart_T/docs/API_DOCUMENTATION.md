# FinD Chart API 문서

이 문서는 FinD Chart 서비스에서 사용 가능한 REST API 엔드포인트를 설명합니다.

## 기본 URL (Base URL)
모든 엔드포인트는 `/api` 접두사를 사용합니다 (표준 설정을 가정).

---

## 캔들 (Candle) API
**기본 경로:** `/api/candles`

### 캔들 데이터 조회 (Get Candle Data)
특정 심볼과 타임프레임에 대한 캔들(OHLCV) 데이터를 조회합니다.

- **엔드포인트:** `GET /:symbol/:timeframe`
- **파라미터:**
  - `symbol`: 주식 또는 자산 심볼 (예: `AAPL`, `BTC-USD`).
  - `timeframe`: 캔들의 타임프레임 (예: `1m`, `1h`, `1d`).

---

## 집계 (Aggregate) API
**기본 경로:** `/api/aggregate`

### 집계 데이터 새로고침 (Refresh Aggregates)
TimescaleDB의 연속 집계(Continuous Aggregates)를 수동으로 새로고침합니다. 데이터를 백필(backfill)한 후 유용하게 사용됩니다.

- **엔드포인트:** `POST /refresh`
- **설명:** TimescaleDB Continuous Aggregate 뷰를 수동으로 갱신합니다.
- **사용 사례:**
  1. 1분봉 데이터를 백필한 후 상위 타임프레임에 즉시 반영하고자 할 때.
  2. 데이터 정합성 문제 발생 시 수동 갱신.

---

## 분석 (Analysis) API
**기본 경로:** `/api/analysis`

### 대시보드 지표 (Dashboard Indicators)
#### 지표 요약 일괄 조회
- **엔드포인트:** `GET /indicators/batch`
- **쿼리 파라미터:**
  - `symbols`: 쉼표로 구분된 심볼 목록 (예: `QQQ,SPY,DIA`).

#### 공포 & 탐욕 지수 (Fear & Greed Index)
- **엔드포인트:** `GET /feargreed`
- **쿼리 파라미터:**
  - `days`: 조회할 과거 데이터 일수 (기본값: 7).

#### 주식 공포 & 탐욕 지수 (CNN)
- **엔드포인트:** `GET /feargreed/stock`
- **설명:** 주식 시장의 공포 & 탐욕 지수(CNN 출처)를 조회합니다.

### 성과 및 계절성 (Performance & Seasonal)
#### 성과 조회
- **엔드포인트:** `GET /:symbol/performance`

#### 계절성 데이터 조회
- **엔드포인트:** `GET /:symbol/seasonal`

#### 지표 요약 조회
- **엔드포인트:** `GET /:symbol/indicators`

### 기술적 지표 (Technical Indicators)
특정 심볼과 타임프레임에 대한 기술적 지표 값을 조회합니다.

- **RSI:** `GET /:symbol/:timeframe/rsi`
- **MACD:** `GET /:symbol/:timeframe/macd`
- **볼린저 밴드 (Bollinger Bands):** `GET /:symbol/:timeframe/bollinger`
- **단순 이동 평균 (SMA):** `GET /:symbol/:timeframe/sma`
- **지수 이동 평균 (EMA):** `GET /:symbol/:timeframe/ema`

---

## 인증 (Auth) API
**기본 경로:** `/api/auth`

### 로그인
- **엔드포인트:** `POST /login`
- **Body:** 로그인 자격 증명 (이메일/사용자명, 비밀번호).

### 회원가입
- **엔드포인트:** `POST /register`
- **Body:** 회원가입 정보.

### 현재 사용자 조회
- **엔드포인트:** `GET /me`
- **설명:** 현재 인증된 사용자의 정보를 조회합니다.

---

## 사용자 (User) API
**기본 경로:** `/api/users`

### 사용자 조회
- **엔드포인트:** `GET /:id`

### 사용자 생성
- **엔드포인트:** `POST /`

### 사용자 수정
- **엔드포인트:** `PATCH /:id`

### 사용자 삭제
- **엔드포인트:** `DELETE /:id`

---

## 알림 (Alert) API
**기본 경로:** `/api/alerts`
**참고:** 모든 엔드포인트는 인증이 필요합니다.

### 모든 알림 조회
- **엔드포인트:** `GET /`

### 알림 상세 조회
- **엔드포인트:** `GET /:id`

### 알림 생성
- **엔드포인트:** `POST /`

### 알림 수정
- **엔드포인트:** `PATCH /:id`

### 알림 삭제
- **엔드포인트:** `DELETE /:id`

---

## 요약 (Summary) API
**기본 경로:** `/api/summary`

### 데이터 상태 확인
- **엔드포인트:** `GET /status`
- **설명:** 데이터의 상태(예: 마지막 업데이트 시간)를 확인합니다.

### 다중 요약 조회
- **엔드포인트:** `GET /`
- **쿼리 파라미터:**
  - `symbols`: 쉼표로 구분된 심볼 목록 (예: `QQQ,SPY`).

### 단일 요약 조회
- **엔드포인트:** `GET /:symbol`
- **설명:** 특정 심볼에 대한 요약 데이터(예: 전일 종가)를 조회합니다.

---

## 시세 (Quote) API
**기본 경로:** `/api/quotes`

### 시장 요약 조회
- **엔드포인트:** `GET /summary`
- **설명:** 전체적인 시장 요약 정보를 조회합니다.

### 티커 바 데이터 조회
- **엔드포인트:** `GET /ticker`

### 카테고리별 시세 조회
- **엔드포인트:** `GET /category/:category`
- **파라미터:**
  - `category`: 자산 카테고리 (예: `stock`, `crypto`).

### 개별 시세 조회
- **엔드포인트:** `GET /:symbol`
- **설명:** 특정 심볼의 최신 시세를 조회합니다.
