## 🤝 Fin:D 프로젝트 협업 가이드 (Git Workflow)

이 저장소는 **Frontend(React)**와 **Backend(FastAPI)**가 통합된 모노레포(Monorepo)입니다.  
팀원 간의 코드 충돌을 방지하기 위해 아래 **작업 루틴**을 반드시 지켜주세요!

---

## 1. 🚀 최초 세팅 (딱 한 번만)

기존에 작업하던 개인 저장소는 더 이상 사용하지 않습니다.  
이 저장소를 새로 받아주세요.

### 1) 저장소 복제 (Clone)

터미널을 열고 아래 명령어를 입력합니다.

```bash
git clone https://github.com/DennyAhn/FinD_Main.git
cd FinD_Main
```

### 2) 라이브러리 설치 (필수 ⭐)

프로젝트를 받으면 라이브러리 설치부터 해야 실행됩니다.

- **Frontend 팀원**

```bash
cd find-front_T
npm install  # 또는 yarn install
npm run dev  # 개발 서버 실행 (http://localhost:5173)
```

- **Backend 팀원**

```bash
cd find-backend_T
# 가상환경 생성 및 실행 후
pip install -r requirements.txt
```

---

## 2. 🔄 매일 반복하는 작업 루틴 (GitHub Flow)

작업을 시작할 때마다 **무조건 이 순서대로** 진행해 주세요.  
**절대 `main` 브랜치에서 직접 작업하지 마세요!**

### Step 1: 출근 (최신 코드 받기)

작업 시작 전, 원격 저장소의 최신 변경사항을 내 컴퓨터로 가져옵니다.

```bash
git checkout main      # 메인 브랜치로 이동
git pull origin main   # 최신 코드 당겨오기 (동기화)
```

### Step 2: 작업 방 만들기 (브랜치 생성)

내가 작업할 기능을 위한 격리된 공간(Branch)을 만듭니다.

- **브랜치 이름 규칙**: `종류/기능이름`
  - 예) `feat/login-ui`, `fix/chart-bug`

```bash
# 예시: 차트 UI 작업 시작
git checkout -b feat/chart-ui
```

### Step 3: 코딩 및 저장 (Commit)

신나게 코드를 짜고, 의미 있는 단위로 커밋합니다.

```bash
git add .
git commit -m "feat: 어닝 서프라이즈 차트 디자인 적용"
```

- **커밋 메시지 머리말 규칙(Prefix)**:
  - **feat**: 새로운 기능 추가
  - **fix**: 버그 수정
  - **style**: 코드 포맷팅, 세미콜론 누락 등 (로직 변경 없음)
  - **refactor**: 코드 리팩토링

### Step 4: 서버에 올리기 (Push)

작업한 내 브랜치를 GitHub에 올립니다.  
(**main에 올리는 게 아닙니다!**)

```bash
git push origin feat/chart-ui
```

### Step 5: 합쳐달라고 요청하기 (Pull Request)

1. GitHub 저장소 페이지 접속
2. 상단에 **"Compare & pull request"** 초록색 버튼 클릭
3. 작업 내용(무엇을 구현했는지)을 작성하고 **Create pull request** 클릭
4. 관리자(PM)가 확인 후 Merge 하면 끝!

---

## 3. 📂 폴더 구조 안내

```plaintext
FinD_Main/
├── find-backend_T/    # FastAPI 서버 코드
│   ├── app/
│   ├── venv/          # (가상환경 - git에 안 올라감)
│   └── requirements.txt
│
├── find-front_T/      # React 클라이언트 코드 (Vite)
│   ├── src/
│   ├── node_modules/  # (라이브러리 - git에 안 올라감)
│   └── package.json
│
├── find-chart_T/      # 차트 서버 코드 (TypeScript/Node.js)
│   ├── src/
│   ├── prisma/
│   └── package.json
│
└── README.md          # 프로젝트 소개 및 사용법
```

---

## 4. ⚠️ 자주 나오는 문제 (Troubleshooting)

- **`npm run dev`가 안 돼요!**
  - `find-front_T` 폴더 안으로 이동했는지(`cd find-front_T`) 확인
  - `npm install` (또는 `yarn install`)을 했는지 확인

- **Push가 안 돼요! (403 Error)**
  - GitHub 초대장(이메일)을 **수락했는지** 확인  
  - 초대 수락 후에야 권한이 생깁니다.

- **충돌(Conflict)이 났어요!**
  - 당황하지 말고 **PM에게 바로 연락** 주세요.  
  - 혼자 해결하려다가 더 꼬이기보다는, 같이 보고 해결하는 게 훨씬 빠릅니다.

---

## 5. 🔥 충돌(Conflict)이 잘 나는 상황 & 예방법

아래 상황에서는 **충돌이 날 확률이 높으니 특히 조심**해 주세요.

### 5-1. 같은 파일, 같은 줄(또는 가까운 줄)을 여러 사람이 고칠 때

- 예시
  - 여러 명이 `find-front_T/src/components/Header.tsx`의 같은 버튼/텍스트를 각각 다른 내용으로 수정
  - `find-backend_T/app/main.py`의 같은 라우트 함수 안 로직을 동시에 수정
- 이유
  - Git이 “어느 쪽이 맞는지”를 자동으로 판단하지 못해서 두 변경을 병합하지 못합니다.

**예방법**
- 큰 파일에서 **서로 다른 부분을 담당**해서 수정하기
- 공용 컴포넌트/핵심 파일은 **누가 건드리는지 슬랙/노션에 먼저 공유**

### 5-2. 설정/환경/lock 파일을 여러 명이 건드릴 때

- 예시
  - `package.json`, `package-lock.json`, `yarn.lock`을 여러 명이 다른 브랜치에서 수정
  - `requirements.txt`에 각자 다른 라이브러리 추가
  - `.env.example`, `tsconfig.json`, `vite.config.ts` 같은 공용 설정 파일 수정

**예방법**
- 설정/lock 파일을 **최대한 한 번에 한 사람만** 수정하도록 조율
- 라이브러리 추가가 필요하면 **먼저 말해두고** 작업

### 5-3. 파일/폴더 이동·삭제 vs 다른 사람의 내용 수정이 겹칠 때

- 예시
  - A: `components/Chart` 폴더를 `components/charts/`로 이동
  - B: 예전 위치의 `components/Chart/index.tsx` 내용을 수정

**예방법**
- 폴더 구조를 크게 바꾸는 작업은 **전담 브랜치**에서 짧게 끝내기
- 구조를 바꾸기 전에 **팀에 먼저 공지**

### 5-4. 포맷터/린터 설정이 통일되지 않았을 때

- 한 사람은 Prettier 자동 포맷 ON, 다른 사람은 OFF
- 같은 줄을 고쳤는데, 한쪽은 **내용 + 포맷 변경**, 다른 쪽은 **내용만 변경**

**예방법**
- 팀 전체가 **동일한 포맷터/린터 설정** 사용
- IDE에서 “저장 시 자동 포맷” 옵션을 맞추기

### 5-5. 오래된 브랜치에서 오래 작업할 때

- 브랜치를 만든 뒤 **`git pull origin main`을 거의 안 하고** 며칠~몇 주 작업
- 그 사이에 `main`에서 같은 파일이 많이 바뀜

**예방법 (중요)**  
- 작업 중간중간 아래처럼 **메인과 자주 동기화**해 주세요.

```bash
git fetch origin
git merge origin/main   # 또는 git rebase origin/main
```

---

## 6. 이 가이드를 업데이트하고 싶다면?

규칙이 바뀌거나 내용을 보완하고 싶으면, 다른 코드 작업과 마찬가지로:

1. `main`에서 브랜치를 새로 판 뒤  
2. `GIT_GUIDE.md` 내용을 수정하고  
3. PR을 올려서 팀 합의를 거친 뒤에 Merge 해 주세요.


