# ELAW — AI 기반 취업 준비 학습 플랫폼

> 목포대학교 융합소프트웨어학과 캡스톤 디자인 프로젝트

---

## 목차

1. [이 서비스가 무엇인가요?](#1-이-서비스가-무엇인가요)
2. [주요 기능](#2-주요-기능)
3. [시작하기 전에 — 사전 준비](#3-시작하기-전에--사전-준비)
4. [설치 및 실행](#4-설치-및-실행)
5. [사용 방법 (단계별 가이드)](#5-사용-방법-단계별-가이드)
6. [화면 구성 안내](#6-화면-구성-안내)
7. [API 엔드포인트 참조](#7-api-엔드포인트-참조)
8. [프로젝트 구조](#8-프로젝트-구조)
9. [기술 스택](#9-기술-스택)
10. [알려진 제약 및 주의사항](#10-알려진-제약-및-주의사항)
11. [자주 묻는 질문 (FAQ)](#11-자주-묻는-질문-faq)

---

## 1. 이 서비스가 무엇인가요?

**ELAW**는 취업을 준비하는 개발자 지망생을 위한 **AI 맞춤형 학습 + 채용 매칭 플랫폼**입니다.

### 핵심 가치

```
내 실력 파악  →  AI 커리큘럼 생성  →  문제 풀이 & 약점 보완  →  기업 채용 매칭  →  포트폴리오 자동 생성
```

- **AI가 나에게 맞는 학습 계획을 짜줍니다.** 목표 직무와 기간을 입력하면 Gemini AI가 주차별 커리큘럼을 자동으로 만들어줍니다.
- **문제를 풀수록 AI 추천이 정교해집니다.** BKT/DKT 알고리즘이 내 풀이 이력을 분석해 가장 효율적인 다음 문제를 추천합니다.
- **취약점을 자동으로 분석합니다.** 어떤 알고리즘 유형이 부족한지 스킬 갭 리포트로 확인할 수 있습니다.
- **채용 공고와 내 역량을 자동으로 매칭합니다.** AI가 0~100점으로 적합도를 계산해 맞는 기업을 추천합니다.
- **포트폴리오를 자동으로 생성합니다.** 학습 데이터를 기반으로 이력서용 포트폴리오를 AI가 작성합니다.

---

## 2. 주요 기능

| 기능 | 설명 |
|------|------|
| **회원 가입 / 로그인** | 이메일 기반 JWT 인증. 학생 / 기업 / 관리자 역할 구분 |
| **외부 플랫폼 연동** | 백준(solved.ac), GitHub, 프로그래머스 아이디를 연결해 풀이 이력 자동 수집 |
| **AI 커리큘럼 자동 생성** | 목표 직무 + 학습 기간 입력 → Gemini가 주차별 계획 생성 |
| **문제 풀이 & 기록** | 30개 직무, 5,855개 문제 보유. 풀이 결과 기록 및 XP 적립 |
| **스킬 갭 분석** | 알고리즘 태그별 정답률 분석 → 취약 영역 자동 식별 |
| **AI 문제 추천** | BKT/DKT 기반으로 내 실력에 딱 맞는 문제 추천 |
| **채용 매칭** | 기업 채용공고 vs 내 역량 AI 매칭 점수(0~100점) 계산 |
| **포트폴리오 자동 생성** | 학습 데이터 기반 AI 자기소개 + 기술 스택 정리 |
| **커뮤니티 게시판** | 공지사항, 대회 정보, 이벤트 확인 |

---

## 3. 시작하기 전에 — 사전 준비

### 필수 소프트웨어

| 항목 | 버전 | 설치 방법 |
|------|------|----------|
| Python | 3.11 이상 | [python.org](https://www.python.org/downloads/) |
| Node.js | 18 이상 | [nodejs.org](https://nodejs.org/) |
| Git | 최신 | [git-scm.com](https://git-scm.com/) |
| Docker (선택) | 최신 | [docker.com](https://www.docker.com/) — Docker로 한번에 실행 시 필요 |

### Gemini API 키 발급 (AI 기능 사용 시 필수)

1. [Google AI Studio](https://aistudio.google.com/)에 접속합니다.
2. 구글 계정으로 로그인 후 **"Get API key"** 클릭합니다.
3. 발급받은 키를 복사해둡니다. 아래 `.env` 설정에서 사용합니다.

> Gemini API 키 없이도 앱은 실행됩니다. 단, AI 커리큘럼/포트폴리오 생성 기능은 기본 템플릿(fallback)으로 동작합니다.

---

## 4. 설치 및 실행

### 방법 A — Docker로 한번에 실행 (권장)

가장 간단한 방법입니다. Docker가 설치되어 있으면 명령 두 줄로 실행됩니다.

**1. 저장소 클론**

```bash
git clone https://github.com/your-org/ELAW.git
cd ELAW
```

**2. 환경 변수 파일 생성**

```bash
cp .env.example backend/.env
```

`.env` 파일을 열고 아래 항목을 수정합니다:

```env
SECRET_KEY=원하는_임의_문자열_32자_이상
DEBUG=True
GEMINI_API_KEY=발급받은_Gemini_API_키
```

**3. 실행**

```bash
docker-compose up --build
```

**4. 초기 데이터 로딩** (최초 1회만)

별도 터미널을 열고:

```bash
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py load_problems
```

**접속 주소**

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:9000
- Django 관리자: http://localhost:9000/admin

---

### 방법 B — 로컬 직접 실행

Docker 없이 백엔드와 프론트엔드를 각각 실행합니다.

#### 백엔드 설정

```bash
# 1. backend 디렉토리로 이동
cd backend

# 2. 가상환경 생성 및 활성화
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate

# 3. 패키지 설치
pip install -r requirements.txt

# (선택) DKT 딥러닝 추천 활성화
pip install torch

# 4. 환경 변수 파일 생성
cp ../.env.example .env
# .env 파일을 열어 SECRET_KEY, GEMINI_API_KEY 등 입력

# 5. 데이터베이스 초기화 (최초 1회)
python manage.py migrate

# 6. 문제 데이터 로딩 (최초 1회, 약 1~2분 소요)
python manage.py load_problems

# 7. 관리자 계정 생성 (선택)
python manage.py createsuperuser

# 8. 서버 실행
python manage.py runserver 9000
```

#### 프론트엔드 설정

```bash
# 새 터미널에서
cd frontend

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

프론트엔드: http://localhost:3000 에서 접속합니다.

---

## 5. 사용 방법 (단계별 가이드)

### Step 1 — 회원가입

http://localhost:3000/register 에 접속해 정보를 입력합니다.

| 항목 | 설명 | 필수 여부 |
|------|------|----------|
| 이름 | 본인 이름 | 필수 |
| 이메일 | 로그인 ID로 사용됩니다 | 필수 |
| 비밀번호 | 8자 이상 | 필수 |
| 전화번호 | 추후 인증에 활용 | 선택 |
| 역할 | student(학생) / company(기업) 중 선택 | 필수 |
| AI 이용 동의 | AI 기능 사용을 위해 동의 필요 | 필수 |
| 개인정보 수집 동의 | | 필수 |

API로 직접 계정 생성하는 방법:

```bash
curl -X POST http://localhost:9000/api/accounts/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "email": "hong@elaw.kr",
    "password": "Test1234!",
    "role": "student",
    "ai_consent": true,
    "privacy_consent": true
  }'
```

---

### Step 2 — 로그인

http://localhost:3000/login 에서 이메일과 비밀번호를 입력합니다.

로그인하면 JWT 토큰이 발급되어 브라우저에 저장됩니다. 이후 모든 API 요청에 자동으로 포함됩니다.

---

### Step 3 — 목표 설정 (최초 1회)

로그인 후 자동으로 `/goal-setting` 으로 이동합니다.

1. **희망 직무** 선택 (예: Backend Engineer, AI Engineer, Data Scientist 등 30개 직무)
2. **학습 기간** 입력 (시작일, 종료일)
3. **목표 등록** 버튼 클릭

등록 즉시 Gemini AI가 주차별 커리큘럼을 자동으로 생성합니다. 키가 없으면 기본 8주 커리큘럼이 생성됩니다.

---

### Step 4 — 대시보드 확인

`/dashboard` 또는 `/home` 에서 전체 현황을 확인합니다.

- 풀이 통계 (총 풀이 수, 정답률, 취득 XP)
- 취약 알고리즘 태그 Top 5
- 내 역량과 매칭되는 채용공고 Top 3
- 언어별 사용 통계

---

### Step 5 — 문제 풀기

`/study` 페이지에서 AI가 추천한 문제를 풀어봅니다.

1. **추천 문제 목록** — BKT/DKT 알고리즘이 현재 실력에 맞는 문제를 선택합니다.
2. **문제 선택** — 문제 클릭 시 상세 내용이 표시됩니다.
3. **풀이 제출** — 맞춤/틀림 결과 선택 및 소요 시간 입력
4. **XP 획득** — 정답 시 경험치 포인트 적립

문제를 풀수록 AI 추천이 정교해집니다. 30개 이상 풀면 DKT(딥러닝) 기반 추천으로 자동 전환됩니다.

---

### Step 6 — 커리큘럼 확인

`/curriculum` 에서 주차별 학습 계획을 확인합니다.

- 전체 학습 기간 및 진행률
- 주차별 학습 주제 (theme)
- 이번 주 해야 할 과제 목록
- 추천 문제 목록 (클릭 시 바로 풀기 가능)

---

### Step 7 — 채용 매칭

`/jobs` 페이지에서 기업 채용공고를 탐색합니다.

1. **공고 목록 확인** — 기업별 요구 스킬, 경력, 마감일 표시
2. **AI 매칭 점수 계산** — "매칭 생성" 버튼 클릭 시 Gemini가 내 역량과 비교해 점수 계산
3. **높은 점수 순으로 정렬** — 나에게 맞는 기업 우선 추천
4. **지원** — 자동 생성된 포트폴리오와 함께 지원

---

### Step 8 — 포트폴리오 생성

`/jobs/[id]` 공고 상세 페이지 또는 `/profile` 에서 포트폴리오를 생성합니다.

AI가 다음을 자동으로 작성합니다:
- 역량 요약 (자기소개)
- 기술 스택 (풀이 이력 기반)
- 학습 통계 (정답률, 알고리즘 분포)
- 주요 학습 프로젝트

생성된 포트폴리오는 공개 URL(`/portfolio/<slug>/`)로 공유하거나 PDF로 다운로드할 수 있습니다.

---

### Step 9 — 외부 플랫폼 연동 (선택)

`/profile` → 플랫폼 연동 섹션에서 외부 계정을 연결합니다.

| 플랫폼 | 수집 데이터 |
|--------|-----------|
| 백준 (solved.ac) | 풀이 문제 목록, 알고리즘 태그, 정답률 |
| GitHub | 커밋 이력, 사용 언어, 리포지토리 |
| 프로그래머스 | 풀이 기록 |

연동 후 "동기화" 버튼을 누르면 외부 풀이 이력이 자동으로 가져와집니다.

---

## 6. 화면 구성 안내

| 경로 | 화면 이름 | 설명 |
|------|----------|------|
| `/` | 랜딩 | 서비스 소개, 로그인하지 않은 사용자 대상 |
| `/register` | 회원가입 | 신규 계정 생성 |
| `/login` | 로그인 | JWT 토큰 발급 |
| `/goal-setting` | 목표 설정 | 희망 직무 및 학습 기간 입력 (최초 1회) |
| `/home` | 홈 | 대시보드로 리다이렉트 |
| `/dashboard` | 대시보드 | 풀이 통계, 취약점, 매칭 기업 현황 |
| `/study` | 학습 | AI 추천 문제 목록 및 풀기 |
| `/curriculum` | 커리큘럼 | 주차별 학습 계획 확인 |
| `/jobs` | 채용 공고 | 기업 공고 목록 및 AI 매칭 |
| `/jobs/[id]` | 공고 상세 | 상세 정보 + 스킬갭 + 포트폴리오 생성 |
| `/board` | 게시판 | 공지, 대회, 이벤트 정보 |
| `/profile` | 프로필 | 개인 정보 조회/수정, 플랫폼 연동 |

---

## 7. API 엔드포인트 참조

모든 API는 `http://localhost:9000` 을 기준으로 합니다.  
로그인이 필요한 API는 요청 헤더에 `Authorization: Bearer <access_token>` 을 포함해야 합니다.

### 인증 (`/api/accounts/`)

| Method | 경로 | 설명 | 인증 필요 |
|--------|------|------|----------|
| POST | `/api/accounts/signup/` | 회원가입 | X |
| POST | `/api/accounts/login/` | 로그인, JWT 발급 | X |
| POST | `/api/accounts/token/refresh/` | 액세스 토큰 갱신 | X |
| GET | `/api/accounts/profile/` | 내 프로필 조회 | O |
| PATCH | `/api/accounts/profile/` | 프로필 수정 | O |
| POST | `/api/accounts/platform/` | 외부 플랫폼 아이디 등록 | O |
| POST | `/api/accounts/platform/sync/` | 외부 데이터 동기화 | O |

**로그인 예시**

```bash
curl -X POST http://localhost:9000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "hong@elaw.kr", "password": "Test1234!"}'
```

응답:
```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

---

### 핵심 기능 (`/api/core/`)

| Method | 경로 | 설명 | 인증 필요 |
|--------|------|------|----------|
| POST | `/api/core/goals/` | 목표 등록 + AI 커리큘럼 생성 | O |
| GET | `/api/core/goals/` | 내 목표 및 커리큘럼 조회 | O |
| GET | `/api/core/dashboard/` | 전체 현황 대시보드 | O |
| GET | `/api/core/problems/` | 문제 목록 (필터·페이지네이션) | O |
| POST | `/api/core/problems/<id>/solve/` | 문제 풀이 제출 | O |
| GET | `/api/core/recommendations/` | AI 추천 문제 목록 | O |
| GET | `/api/core/skill-gaps/` | 스킬 갭 분석 결과 | O |
| POST | `/api/core/matches/generate/` | AI 채용 매칭 점수 계산 | O |
| POST | `/api/core/portfolio/generate/` | AI 포트폴리오 생성 | O |
| POST | `/api/core/portfolio/feedback/` | 포트폴리오 피드백 요청 | O |

**목표 설정 예시**

```bash
curl -X POST http://localhost:9000/api/core/goals/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "goal_type": "JOB",
    "job_role": "Backend Engineer",
    "duration_weeks": 8,
    "start_date": "2026-05-07"
  }'
```

**문제 풀이 제출 예시**

```bash
curl -X POST http://localhost:9000/api/core/problems/1/solve/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SOLVED",
    "time_spent_min": 25
  }'
```

---

### 게시판 (`/api/board/`)

| Method | 경로 | 설명 | 인증 필요 |
|--------|------|------|----------|
| GET | `/api/board/` | 게시글 목록 | X |
| GET | `/api/board/<id>/` | 게시글 상세 | X |
| POST | `/api/board/` | 게시글 작성 (관리자만) | O |
| PUT | `/api/board/<id>/` | 게시글 수정 (관리자만) | O |
| DELETE | `/api/board/<id>/` | 게시글 삭제 (관리자만) | O |

---

### DB 관리 (`/api/db/`) — 개발·관리용

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/db/summary/` | 전체 테이블 건수 요약 |
| GET | `/api/db/users/` | 사용자 전체 조회 |
| GET | `/api/db/ai-logs/` | Gemini API 호출 이력 |

---

## 8. 프로젝트 구조

```
ELAW/
├── backend/                   Django REST API (포트 9000)
│   ├── accounts/              회원가입 · 로그인 · 프로필 · 플랫폼 연동
│   ├── board/                 커뮤니티 게시판 CRUD
│   ├── core/
│   │   ├── models_*.py        ORM 데이터 모델
│   │   ├── services/          서비스 레이어
│   │   │   ├── recommender_service.py   BKT/DKT 문제 추천
│   │   │   ├── skill_gap_service.py     스킬 갭 계산
│   │   │   └── portfolio_service.py     포트폴리오 생성
│   │   ├── etl/               외부 데이터 수집기
│   │   │   ├── baekjoon_collector.py    백준 solved.ac 연동
│   │   │   └── github_collector.py      GitHub 연동
│   │   ├── views_user.py      목표·대시보드·매칭 API
│   │   ├── views_solve.py     문제풀기·추천·포트폴리오 API
│   │   ├── views_db.py        DB 관리 API
│   │   └── signals.py         풀이 저장 → 스킬갭 자동 재계산
│   └── config/                Django 설정 · URL 라우팅
│
├── frontend/                  Next.js 16 App Router (포트 3000)
│   ├── app/                   페이지 라우트
│   │   ├── page.tsx           랜딩
│   │   ├── login/
│   │   ├── register/
│   │   ├── goal-setting/
│   │   ├── dashboard/
│   │   ├── study/
│   │   ├── curriculum/
│   │   ├── jobs/
│   │   ├── board/
│   │   └── profile/
│   ├── components/            공통 UI 컴포넌트 (shadcn/ui)
│   └── lib/
│       ├── api.ts             공통 API 클라이언트 (JWT 자동 주입)
│       └── utils.ts           Tailwind 유틸리티
│
├── models/                    AI 추천 모델 (독립 Python 모듈)
│   ├── recommender.py         BKT 기반 문제 추천
│   └── dkt.py                 DKT(LSTM) 심화 추천 (torch 필요)
│
├── DB/
│   ├── JobProblems/           직무별 문제 JSON (30개 직무, 5,855문제)
│   └── LearningPaths/         학습 경로 그래프 JSON (직무별 30개)
│
├── docs/                      문서
│   ├── README.md              ← 지금 이 파일
│   └── PROGRESS.md            개발 진행 현황
│
├── .env.example               환경 변수 템플릿
└── docker-compose.yml         통합 실행 설정
```

---

## 9. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 백엔드 언어 | Python | 3.11+ |
| 백엔드 프레임워크 | Django + Django REST Framework | 6.0.x |
| 인증 | SimpleJWT | - |
| 프론트엔드 | Next.js (App Router) | 16.2 |
| UI 언어 | TypeScript | 5.7 |
| 스타일링 | Tailwind CSS + shadcn/ui | v4 |
| 폼 검증 | React Hook Form + Zod | - |
| 데이터베이스 | SQLite (개발) / MySQL (운영) | - |
| AI | Google Gemini 2.0 Flash | - |
| AI 추천 | BKT (Bayesian Knowledge Tracing) | 자체 구현 |
| AI 추천 (심화) | DKT (LSTM, PyTorch) | 자체 구현 |
| 컨테이너 | Docker + Docker Compose | - |

---

## 10. 알려진 제약 및 주의사항

| 항목 | 현상 | 해결 방법 |
|------|------|----------|
| **Gemini API 미설정** | AI 커리큘럼·포트폴리오가 기본 템플릿으로 생성됨 | `.env`에 `GEMINI_API_KEY` 추가 |
| **DKT 미활성화** | 딥러닝 기반 추천 대신 BKT만 동작 | `pip install torch` 설치 |
| **채용 공고 없음** | `/jobs` 페이지에 공고가 표시되지 않음 | 더미 데이터 입력 또는 관리자 어드민에서 추가 |
| **SQLite 동시 접근** | `load_problems` 실행 중 서버 사용 시 `database is locked` 오류 | 서버 종료 후 실행, 또는 MySQL로 전환 |
| **게시판 하드코딩** | `/board` 페이지 일부가 하드코딩된 데이터를 표시 | 개발 진행 중 |

---

## 11. 자주 묻는 질문 (FAQ)

**Q. 로그인 후 빈 페이지가 표시됩니다.**  
A. 목표 설정을 아직 하지 않은 경우입니다. `/goal-setting`으로 이동해 목표를 먼저 입력하세요.

**Q. AI 커리큘럼이 영어/이상한 내용으로 생성됩니다.**  
A. Gemini API 키가 설정되지 않아 기본 템플릿이 사용되고 있습니다. `.env` 파일에 `GEMINI_API_KEY`를 추가하세요.

**Q. 채용 공고 목록이 비어있습니다.**  
A. 현재 채용 공고 데이터가 입력되어 있지 않습니다. Django 관리자(`/admin`)에서 JobPosting과 Company 데이터를 직접 추가하거나, 개발팀에 문의하세요.

**Q. 백준 연동을 했는데 풀이 기록이 가져와지지 않습니다.**  
A. 플랫폼 연동 후 "동기화" 버튼을 눌러야 합니다. solved.ac API 상태에 따라 일부 데이터가 누락될 수 있습니다.

**Q. Docker로 실행 시 프론트엔드가 API에 접근하지 못합니다.**  
A. `frontend/.env.local` 파일에 `NEXT_PUBLIC_API_URL=http://localhost:9000`이 설정되어 있는지 확인하세요.

**Q. `database is locked` 오류가 발생합니다.**  
A. SQLite는 동시 쓰기를 지원하지 않습니다. 서버를 종료하고 `load_problems`를 실행하거나, MySQL로 전환하세요. `backend/config/settings.py`에서 DATABASE 설정을 변경할 수 있습니다.

---

*이 문서에 오류나 누락된 내용이 있으면 GitHub Issues를 통해 알려주세요.*
