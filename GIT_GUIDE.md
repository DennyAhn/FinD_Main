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
cd frontend
npm install  # 또는 yarn install
```

- **Backend 팀원**

```bash
cd backend
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
├── backend/           # FastAPI 서버 코드
│   ├── app/
│   ├── venv/          # (가상환경 - git에 안 올라감)
│   └── requirements.txt
│
├── frontend/          # React 클라이언트 코드
│   ├── src/
│   ├── node_modules/  # (라이브러리 - git에 안 올라감)
│   └── package.json
│
└── README.md          # 프로젝트 소개 및 사용법
```

---

## 4. ⚠️ 자주 나오는 문제 (Troubleshooting)

- **`npm start`가 안 돼요!**
  - `frontend` 폴더 안으로 이동했는지(`cd frontend`) 확인
  - `npm install` (또는 `yarn install`)을 했는지 확인

- **Push가 안 돼요! (403 Error)**
  - GitHub 초대장(이메일)을 **수락했는지** 확인  
  - 초대 수락 후에야 권한이 생깁니다.

- **충돌(Conflict)이 났어요!**
  - 당황하지 말고 **PM에게 바로 연락** 주세요.  
  - 혼자 해결하려다가 더 꼬이기보다는, 같이 보고 해결하는 게 훨씬 빠릅니다.

---

## 5. 이 가이드를 업데이트하고 싶다면?

규칙이 바뀌거나 내용을 보완하고 싶으면, 다른 코드 작업과 마찬가지로:

1. `main`에서 브랜치를 새로 판 뒤  
2. `GIT_GUIDE.md` 내용을 수정하고  
3. PR을 올려서 팀 합의를 거친 뒤에 Merge 해 주세요.


