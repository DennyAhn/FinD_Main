# FIN:D - 금융 데이터 분석 데스크탑 앱

React + TypeScript + Vite 기반의 금융 데이터 분석 데스크탑 애플리케이션입니다.

## 기술 스택

- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구
- **React Router** - 라우팅
- **Zustand** - 상태 관리
- **Axios** - HTTP 클라이언트
- **Recharts** - 차트 라이브러리

## 프로젝트 구조

```
find-frontend/
├── public/                 # 정적 파일
├── src/
│   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── common/        # 공통 컴포넌트
│   │   ├── charts/        # 차트 컴포넌트
│   │   ├── financial/     # 금융 데이터 컴포넌트
│   │   └── layout/        # 레이아웃 컴포넌트
│   ├── pages/             # 페이지 컴포넌트
│   │   ├── Dashboard/     # 대시보드
│   │   ├── Company/       # 기업 상세
│   │   ├── Chat/          # AI 채팅
│   │   └── Search/        # 검색
│   ├── services/          # API 서비스
│   │   ├── api/           # API 클라이언트
│   │   └── auth/          # 인증 서비스
│   ├── store/             # 상태 관리 (Zustand)
│   ├── hooks/              # 커스텀 훅
│   ├── utils/              # 유틸리티 함수
│   ├── types/              # TypeScript 타입 정의
│   ├── styles/             # 전역 스타일
│   ├── App.tsx             # 메인 앱 컴포넌트
│   └── main.tsx            # 진입점
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

## 환경 변수

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_API_VERSION=v1
```

