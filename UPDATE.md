# Fin:D 프로젝트 업데이트 로그

이 문서는 Fin:D 프로젝트에 적용된 주요 변경사항과 개선사항을 기록합니다.

---

## 📅 최근 업데이트 (2024-12-06)

### 🎨 로그인 페이지 UI/UX 대폭 개선

#### 1. 로그인 프로세스 애니메이션 개선
**파일**: `find-front_T/src/pages/Login/Login.tsx`, `find-front_T/src/pages/Login/Login.css`

**개선사항**:
- "Logging in..." 화면 최소 3초 보장 로직 확인 및 검증
- "Login Successful!" 메시지가 제대로 표시된 후 리다이렉트되도록 수정
- `useEffect`에서 로그인 프로세스 중 리다이렉트 방지 로직 추가
- 초기 로딩 애니메이션 시간 0.5초 단축 (5초 → 4.5초)

**주요 코드**:
```typescript
// 로그인 프로세스 중에는 리다이렉트하지 않도록 수정
useEffect(() => {
  if (isAuthenticated && loginStatus === 'idle') {
    console.log('✅ Already authenticated, redirecting to dashboard')
    window.location.href = '/'
  }
}, [isAuthenticated, loginStatus])

// 성공 화면 표시를 위해 2초 대기 후 리다이렉트
setLoginStatus('success')
await new Promise(resolve => setTimeout(resolve, 2000))
window.location.href = '/'
```

**타임라인**:
- 0~3초: "Logging in..." 표시 (최소 3초 보장)
- 3~5초: "Login Successful!" 표시 (2초간)
- 5초: 대시보드로 이동

#### 2. 브랜딩 및 서브타이틀 개선
**파일**: `find-front_T/src/pages/Login/Login.tsx`, `find-front_T/src/pages/Login/Login.css`

**변경사항**:
- 서브타이틀 변경: "금융 데이터 분석 플랫폼" → **"Data to Insight, 가치를 찾다"**
- Fin:D 로고 크기 조정 (32px → 36px)
- FINANCIAL INTELLIGENCE 태그라인 크기 및 간격 조정
- 서브타이틀에 보라색 그라데이션 효과 적용
- 서브타이틀 크기 조정 (15px → 16px)

**스타일 개선**:
```css
.login-subtitle {
  background: linear-gradient(90deg, 
    rgba(167, 139, 250, 0.95) 0%, 
    rgba(99, 102, 241, 0.95) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 16px;
  font-weight: 600;
  animation: subtitleShimmer 3s ease-in-out infinite;
}
```

#### 3. 동적 효과 추가
**파일**: `find-front_T/src/pages/Login/Login.css`

**추가된 효과**:
- **서브타이틀 Shimmer 효과**: 그라데이션이 좌우로 부드럽게 움직이는 프리미엄 효과
- **로그인 버튼 Shimmer 효과**: 계속해서 빛이 지나가는 효과로 클릭 유도
- **탭 전환 슬라이드 애니메이션**: 로그인/회원가입 탭 전환 시 부드러운 슬라이드 효과

**애니메이션 코드**:
```css
@keyframes subtitleShimmer {
  0% { background-position: 0% center; }
  50% { background-position: 100% center; }
  100% { background-position: 0% center; }
}

@keyframes buttonShimmer {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

@keyframes formSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

#### 4. 파비콘 및 페이지 타이틀 업데이트
**파일**: `find-front_T/index.html`

**변경사항**:
- 파비콘을 Fin:D 로고로 변경 (`/vite.svg` → `/favicon.svg`)
- 페이지 타이틀 변경: "FIN:D - 금융 데이터 분석" → **"Fin:D - Financial Intelligence"**
- SEO를 위한 메타 설명 추가

---

### 🎯 기업 디테일 페이지 개선

#### 1. 탭 전환 슬라이드 애니메이션 추가
**파일**: `find-front_T/src/pages/Company/CompanyDetail.tsx`, `find-front_T/src/pages/Company/CompanyDetail.css`

**개선사항**:
- 개요/차트/재무제표/뉴스/투자의견 탭 전환 시 부드러운 슬라이드 애니메이션
- 각 탭 컨텐츠에 고유 `key` prop 추가로 React가 전환을 인식
- 로그인 페이지와 동일한 스타일로 일관성 유지

**애니메이션**:
```css
.tab-content-wrapper {
  animation: tabSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes tabSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

#### 2. 탭 초기화 로직 추가
**파일**: `find-front_T/src/pages/Company/CompanyDetail.tsx`

**개선사항**:
- 기업 디테일 페이지 진입 시 항상 '개요' 탭이 기본으로 표시되도록 수정
- ticker 변경 시 `activeTab`을 'overview'로 자동 리셋

**코드**:
```typescript
// ticker가 변경될 때마다 항상 'overview' 탭으로 리셋
useEffect(() => {
  setActiveTab('overview')
}, [ticker])
```

---

### 📊 재무제표 컴포넌트 개선

#### 1. 탭 전환 슬라이드 애니메이션 추가
**파일**: `find-front_T/src/components/widgets/FinancialStatementsView.tsx`, `find-front_T/src/components/widgets/Widgets.css`

**개선사항**:
- 손익계산서/재무상태표/현금흐름표 탭 전환 시 슬라이드 애니메이션
- 연간/분기 전환 시에도 부드러운 애니메이션
- 연도 범위 변경 시에도 애니메이션 적용

**구현**:
- 각 탭 컨텐츠에 `key` prop 추가 (`${activeSubTab}-${period}-${yearRange}`)
- 기업 디테일 페이지와 동일한 애니메이션 스타일 적용

---

### 🔧 백엔드 안정성 개선

#### 1. Balance Sheet 서비스 중복 키 에러 처리 개선
**파일**: `find-backend_T/app/services/balance_sheet_service.py`

**문제**:
- Race condition 발생 시 중복 키 에러로 전체 트랜잭션 롤백
- 동시 요청 시 데이터 손실 발생
- 세션 롤백 후 계속 사용하려고 시도하여 추가 에러 발생

**해결**:
- 각 항목을 개별적으로 처리하여 중복 키 에러 방지
- 중복 키 에러 발생 시 자동으로 기존 레코드를 재조회하여 업데이트
- 일부 항목 실패해도 나머지 항목은 정상 처리되도록 개선

**주요 코드**:
```python
# 각 항목을 개별적으로 처리하여 중복 키 에러 방지
try:
    if existing:
        # 기존 레코드 업데이트
        existing.total_assets = total_assets_val
        # ... 필드 업데이트
    else:
        # 새 레코드 추가
        record = models.CompanyBalanceSheet(...)
        db.add(record)
    
    # 각 항목마다 즉시 커밋 (중복 에러 발생 시 해당 항목만 롤백)
    db.commit()
except Exception as item_error:
    db.rollback()
    # 중복 키 에러인 경우 기존 레코드를 다시 조회하여 업데이트
    if "Duplicate entry" in str(item_error):
        existing_retry = db.query(...).first()
        if existing_retry:
            # 기존 레코드 업데이트
            existing_retry.total_assets = total_assets_val
            # ... 필드 업데이트
            db.commit()
```

**개선 효과**:
- ✅ 중복 키 에러 자동 복구
- ✅ Race condition 안전 처리
- ✅ 부분 실패 허용 (일부 항목 실패해도 나머지 계속 처리)
- ✅ 데이터 정확성 유지 (기존 로직과 동일한 데이터 처리)

#### 2. Key Metrics 서비스 세션 롤백 문제 해결
**파일**: `find-backend_T/app/services/key_metrics_service.py`

**문제**:
- `fetch_company_balance_sheets` 호출 후 불필요한 `db.commit()` 호출
- 에러 발생 시 세션 롤백 처리 부족

**해결**:
- `fetch_company_balance_sheets` 내부에서 이미 커밋하므로 외부 커밋 제거
- 에러 발생 시 `db.rollback()` 추가로 세션 정리

**코드**:
```python
# Before
await fetch_company_balance_sheets(ticker, db, client, normalized_period, limit=5)
db.commit()  # 불필요한 커밋

# After
await fetch_company_balance_sheets(ticker, db, client, normalized_period, limit=5)
# fetch_company_balance_sheets 내부에서 이미 commit하므로 여기서는 commit 불필요

except Exception as fetch_error:
    print(f"[D/E] Failed to fetch Balance Sheet: {fetch_error}")
    db.rollback()  # 에러 발생 시 세션 롤백
```

#### 3. React Router Future Flag 추가
**파일**: `find-front_T/src/App.tsx`

**변경사항**:
- React Router v7 업그레이드 준비를 위한 `v7_startTransition` 플래그 추가
- 네비게이션 상태 업데이트를 `React.startTransition`으로 감싸 더 부드러운 페이지 전환

**코드**:
```typescript
<BrowserRouter
  future={{
    v7_startTransition: true,
  }}
>
```

---

## 📅 최근 업데이트 (2024-12-06) - 이전

### 🔐 인증 시스템 개선 (세션 기반 인증)

#### 1. 로그인 Race Condition 수정
**파일**: `find-front_T/src/pages/Login/Login.tsx`

**문제**:
- 로그인 성공 후 대시보드로 이동하지 않고 로그인 페이지에 머무르는 문제 발생
- Zustand store의 상태 업데이트와 페이지 리다이렉트 사이의 타이밍 문제 (race condition)

**해결**:
- `window.location.href` 호출 전에 100ms 지연 추가
- Zustand store의 `isAuthenticated` 상태 업데이트가 완료될 시간 확보

**주요 코드**:
```typescript
login(response.access_token)
console.log('✅ Token saved, redirecting...')

// 상태 업데이트를 위한 짧은 지연 후 리다이렉트
setTimeout(() => {
  window.location.href = '/'
}, 100)
```

#### 2. 세션 기반 인증 구현 (localStorage → sessionStorage)
**파일**: 
- `find-front_T/src/store/useAuthStore.ts`
- `find-front_T/src/services/api/client.ts`
- `find-front_T/src/services/api/auth.ts`

**변경사항**:
- 모든 `localStorage` 호출을 `sessionStorage`로 변경
- 브라우저 탭을 닫으면 자동으로 로그아웃되도록 개선
- 같은 탭 내에서 새로고침 시에는 로그인 상태 유지

**영향**:
- ✅ 탭 닫으면 자동 로그아웃
- ✅ 같은 탭에서 F5 새로고침 시 로그인 유지
- ✅ 새 탭에서 사이트 접속 시 로그인 필요

**주요 변경**:
```typescript
// Before
localStorage.setItem('access_token', token)
localStorage.getItem('access_token')
localStorage.removeItem('access_token')

// After
sessionStorage.setItem('access_token', token)
sessionStorage.getItem('access_token')
sessionStorage.removeItem('access_token')
```

#### 3. 중복 토큰 저장 로직 제거
**파일**: `find-front_T/src/services/api/auth.ts`

**변경사항**:
- API 레이어에서 토큰을 직접 저장하던 로직 제거
- 토큰 저장은 `useAuthStore`의 `login()` 함수에서만 처리 (단일 책임 원칙)

#### 4. 미사용 변수 제거
**파일**: `find-front_T/src/pages/Login/Login.tsx`

**변경사항**:
- `useNavigate` import 제거
- `navigate` 변수 선언 제거
- Lint 경고 해결 (현재 `window.location.href` 사용 중)

---

### 🐛 버그 수정

#### 1. marketHours.ts 정의되지 않은 변수 오류 수정
**파일**: `find-front_T/src/utils/marketHours.ts`

**문제**:
- `getTimeUntilMarketOpen()` 함수에서 `easternHour`, `easternMinute`, `easternDay` 변수가 정의되지 않음
- `easternFormatter` 변수가 정의되지 않아 런타임 에러 발생
- 로그인 후 검은 화면 표시 (TopNav 컴포넌트에서 에러 발생)

**해결**:
```typescript
// Before (208번 라인)
const eastern = getEasternTime(now)
// ... 
const currentMinutes = easternHour * 60 + easternMinute  // ❌ 정의되지 않음

// After
const { hour: easternHour, minute: easternMinute, day: easternDay } = getEasternTime(now)
const currentMinutes = easternHour * 60 + easternMinute  // ✅ 정상 작동
```

```typescript
// Before (266번 라인)
const testParts = easternFormatter.formatToParts(testTime)  // ❌ 정의되지 않음

// After (259번 라인에 추가)
const easternFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false
})
// ...
const testParts = easternFormatter.formatToParts(testTime)  // ✅ 정상 작동
```

**영향**:
- TopNav 컴포넌트 정상 렌더링
- 미국 시장 개장/마감 시간 표시 정상 작동
- 로그인 후 검은 화면 문제 해결

---

## 📅 이전 업데이트 (2024)

### 🔐 인증 시스템 개선

#### 1. 로그인 플로우 수정
**파일**: `find-front_T/src/pages/Login/Login.tsx`

**변경사항**:
- 로그인 성공 후 화면 전환 문제 해결
- `navigate('/')` → `window.location.href = '/'`로 변경하여 확실한 리다이렉트 보장
- 응답 데이터 검증 로직 추가 (`access_token` 존재 여부 확인)
- 디버깅을 위한 콘솔 로그 추가

**주요 코드**:
```typescript
const handleLogin = async (e: React.FormEvent) => {
  // ... 로그인 API 호출
  login(response.access_token)
  window.location.href = '/' // 페이지 새로고침하며 리다이렉트
}
```

#### 2. 로그아웃 기능 개선
**파일**: `find-front_T/src/components/layout/Sidebar.tsx`

**변경사항**:
- 로그아웃 후 리다이렉트 방식 개선
- `navigate('/login')` → `window.location.href = '/login'`로 변경
- 페이지 새로고침을 통한 상태 초기화 보장

**주요 코드**:
```typescript
const handleLogout = () => {
  logout()
  window.location.href = '/login'
}
```

#### 3. ProtectedRoute 인증 체크 활성화
**파일**: `find-front_T/src/components/auth/ProtectedRoute.tsx`

**변경사항**:
- 개발용 `DEV_MODE_BYPASS_AUTH` 플래그 제거
- 인증되지 않은 사용자는 자동으로 로그인 페이지로 리다이렉트
- 프로덕션 환경에 맞는 인증 보호 구현

**주요 코드**:
```typescript
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}
```

#### 4. 로그인 페이지 리다이렉트 개선
**파일**: `find-front_T/src/pages/Login/Login.tsx`

**변경사항**:
- 이미 로그인된 사용자가 로그인 페이지에 접근 시 대시보드로 자동 리다이렉트
- `window.location.href`를 사용하여 확실한 리다이렉트 보장

---

### 🎨 UI/UX 개선

#### 1. 로그인 페이지 CSS 개선
**파일**: `find-front_T/src/pages/Login/Login.css`

**변경사항**:
- CSS 변수에 fallback 값 추가 (변수 미정의 시에도 정상 표시)
- `.login-container`에 `width: 100vw`, `z-index` 추가
- `.login-card`에 `z-index` 추가하여 레이어링 보장
- 모든 색상 변수에 기본값 추가

**주요 스타일**:
```css
.login-container {
  width: 100vw;
  position: relative;
  z-index: 1;
}

.login-card {
  position: relative;
  z-index: 2;
}

.login-logo {
  color: var(--color-text, #e8e9ed); /* fallback 추가 */
}
```

#### 2. Body 스크롤 개선
**파일**: `find-front_T/src/styles/index.css`

**변경사항**:
- `overflow: hidden` → `overflow-x: hidden; overflow-y: auto;`로 변경
- 로그인 페이지에서 스크롤 가능하도록 개선

---

### 🐛 버그 수정

#### 1. Framer Motion 애니메이션 타입 오류 수정
**파일**: `find-front_T/src/pages/Company/CompanyDetail.tsx`

**문제**:
- `ease: 'easeOut'` (문자열) 타입 오류 발생
- framer-motion의 `Variants` 타입 요구사항 불일치

**해결**:
- `ease: 'easeOut'` → `ease: [0.4, 0, 0.2, 1]` (cubic-bezier 배열)로 변경
- TypeScript 타입 오류 해결

**주요 코드**:
```typescript
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const, // cubic-bezier for easeOut
      delay: index * 0.05
    }
  })
}
```

---

## 📋 이전 주요 업데이트

### 🎯 대시보드 UI 개선
- 주식 카드에 고급 UI 효과 적용
  - 그라데이션 테두리 (hover 시)
  - 동적 로고 글로우 효과
  - 스포트라이트 호버 효과
- Staggered Entry Animation 추가 (framer-motion)
- 색상 개선 (파스텔 톤 적용)

### 💬 채팅 사이드바 개선
- AI 모델 선택 기능 추가 (basic/premium)
- 아이콘 통합 및 크기 조정
- 레이아웃 및 디자인 개선
- 토글 버튼을 TopNav로 이동

### 🧭 네비게이션 개선
- TopNav 배경색을 대시보드와 일치
- 로고 제거 및 레이아웃 개선
- Sidebar 크기 증가 및 둥근 레이아웃 적용
- Floating & Rounded Sidebar 디자인 적용

### ⏰ 시장 시간 동기화
- 서버 시간 동기화 기능 추가
- 미국 시장 개장/마감 시간 정확도 개선
- DST (일광절약시간) 처리 개선

### 🔄 새로고침 문제 해결
- `/company` 페이지 새로고침 시 빈 화면 문제 해결
- `useAllCompanies` 훅의 로딩 로직 개선
- 에러 처리 및 상태 관리 개선

---

## 🔧 기술 스택

- **Frontend**: React + TypeScript + Vite
- **상태 관리**: Zustand
- **라우팅**: React Router v6
- **스타일링**: CSS Modules
- **애니메이션**: Framer Motion
- **HTTP 클라이언트**: Axios

---

## 📝 참고사항

- 모든 변경사항은 테스트를 거쳐 적용되었습니다.
- 로그인/로그아웃 기능은 프로덕션 환경에 맞게 최적화되었습니다.
- UI 개선사항은 사용자 경험을 향상시키기 위해 지속적으로 업데이트됩니다.

---

**마지막 업데이트**: 2024-12-06

