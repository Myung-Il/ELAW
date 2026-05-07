# ELAW 백엔드 README

> **대상 독자**: 새로 합류한 팀원, 프론트엔드 개발자, DB 담당자
> 이 문서는 백엔드의 전체 구조와 실행 방법을 누구나 쉽게 이해할 수 있도록 작성되었습니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 기능 요약](#2-핵심-기능-요약)
3. [기술 스택](#3-기술-스택)
4. [폴더 및 파일 구조](#4-폴더-및-파일-구조)
5. [로컬 실행 방법 (How to Run)](#5-로컬-실행-방법-how-to-run)
6. [전체 API 엔드포인트 목록](#6-전체-api-엔드포인트-목록)
7. [인증 방법 (JWT)](#7-인증-방법-jwt)
8. [환경변수 (.env) 설정](#8-환경변수-env-설정)
9. [프론트엔드 연동 가이드](#9-프론트엔드-연동-가이드)

---

## 1. 프로젝트 개요

**ELAW**는 취업 준비 플랫폼입니다.
학생이 백준·GitHub 같은 외부 플랫폼에 연동하면, 백엔드가 데이터를 수집하고 **Gemini AI**가 개인 맞춤형 학습 커리큘럼과 포트폴리오를 자동으로 생성해 줍니다.

```
사용자 가입/로그인
    ↓
외부 플랫폼 연동 (백준, GitHub)
    ↓
ETL: 풀이 이력·언어 통계 자동 수집
    ↓
Gemini AI: 커리큘럼 생성 → 취약점 분석 → 매칭 점수 계산
    ↓
프론트엔드에 JSON API로 제공
```

---

## 2. 핵심 기능 요약

| 기능 | 설명 | 담당 앱 |
|------|------|---------|
| **회원가입 / 로그인** | 이메일+비밀번호 가입, JWT 토큰 발급 | `accounts` |
| **프로필 조회·수정** | 내 이름·전화번호·AI동의 여부 수정 | `accounts` |
| **외부 플랫폼 연동** | 백준·GitHub 아이디 등록, 풀이 이력 자동 수집 | `accounts` |
| **목표 등록 + AI 커리큘럼 생성** | 관심 직무와 분야 입력 → Gemini가 주차별 커리큘럼 자동 생성 | `core` |
| **AI 매칭 점수 계산** | 내 언어·알고리즘 스킬 vs 채용공고 요구 스킬 비교 → 점수 0~100 | `core` |
| **대시보드 조회** | 풀이 통계·커리큘럼·매칭 Top3·포트폴리오·플랫폼 연동 현황을 한 번에 반환 | `core` |
| **게시판** | 공지사항·대회·이벤트 글 목록·상세 조회 (관리자만 작성 가능) | `board` |
| **DB 데이터 조회** | 개발/디버깅용 테이블 전체 조회 API (요약 포함) | `core/views_db` |

---

## 3. 기술 스택

| 항목 | 내용 |
|------|------|
| 언어 | Python 3.x |
| 프레임워크 | **Django** + **Django REST Framework (DRF)** |
| 인증 | **JWT** (djangorestframework-simplejwt) — Access 60분, Refresh 14일 |
| AI | **Google Gemini 2.0 Flash** API |
| DB | 기본: **SQLite3** (로컬 개발) → 운영: **MySQL 8.0** 전환 가능 |
| CORS | django-cors-headers (현재 전체 오픈, 운영 시 도메인 제한 필요) |
| ETL | solved.ac(백준) 크롤링, GitHub API 수집 |

---

## 4. 폴더 및 파일 구조

```
backend/
│
├── manage.py                    # Django 관리 명령어 진입점
│                                # 예) python manage.py runserver
│
├── test_my_apis.http            # REST Client(VS Code 등)용 API 테스트 파일
│                                # 실제 요청 예시가 담겨 있어 개발 중 참고하기 좋음
│
├── config/                      # ★ Django 프로젝트 설정 폴더 (핵심 설정은 여기)
│   ├── settings.py              # DB 연결·설치된 앱·JWT 설정·CORS 등 전역 설정
│   ├── urls.py                  # 최상위 URL 라우팅 (모든 API 주소가 여기서 시작)
│   ├── wsgi.py                  # 운영 서버 배포용 (WSGI 인터페이스)
│   └── asgi.py                  # 비동기 배포용 (WebSocket 등 향후 확장 대비)
│
├── accounts/                    # ★ 인증·사용자 관리 앱
│   ├── views.py                 # 회원가입/프로필/플랫폼 연동/동기화 API 구현
│   ├── urls.py                  # /api/accounts/ 하위 URL 정의
│   ├── serializers.py           # User, Profile, PlatformLink → JSON 변환 규칙
│   ├── models.py                # (비어 있음 — 사용자 모델은 core.models.User)
│   └── migrations/              # DB 마이그레이션 파일 폴더
│
├── core/                        # ★ 핵심 비즈니스 로직 앱 (AI, 커리큘럼, 매칭 등)
│   │
│   ├── models.py                # 메인 데이터 모델 12개 정의
│   │                            # User, Company, PlatformLink, UserGoal, Curriculum,
│   │                            # SolveHistory, LearningStats, Portfolio, JobPosting,
│   │                            # Match, Post, AiLog
│   │
│   ├── models_dataset.py        # HuggingFace 데이터셋용 모델
│   │                            # DatasetEntry, DatasetResume, DatasetJobDescription 등
│   │
│   ├── models_new.py            # 확장 모델 (스킬 갭 분석, 포트폴리오 스냅샷 등)
│   │                            # SkillGap, ProblemRecommendation, PortfolioSnapshot,
│   │                            # PortfolioFeedback
│   │
│   ├── models_problems.py       # 문제 데이터셋 모델 (30직군 × 200문제)
│   │                            # JobProblem, LearningPathMeta, ProblemEdge 등
│   │
│   ├── models_register.py       # core/models.py 하단에서 import하여 한 번에 등록
│   │
│   ├── views.py                 # 기타 뷰 (현재 거의 비어 있음)
│   ├── views_user.py            # ★ 핵심 사용자 API 뷰
│   │                            #   GoalView        : 목표 등록 → Gemini 커리큘럼 자동 생성
│   │                            #   MatchGenerateView: AI 매칭 점수 계산 및 DB 저장
│   │                            #   DashboardView   : 전체 현황 한 번에 조회
│   │
│   ├── views_db.py              # 디버깅/대시보드용 테이블 전체 조회 API
│   │                            # (DBUserView, DBCompanyView, DBSummaryView 등)
│   │
│   ├── serializers.py           # core 모델들의 JSON 직렬화 규칙
│   ├── urls.py                  # core 앱 자체 URL (현재 views_user/views_db는 config/urls.py에서 직접 등록)
│   │
│   ├── etl/                     # ★ 외부 플랫폼 데이터 수집 모듈 (ETL)
│   │   ├── baekjoon_collector.py # solved.ac API로 백준 풀이 이력 수집
│   │   │                         # → SolveHistory + LearningStats 자동 업데이트
│   │   └── github_collector.py   # GitHub API로 레포지토리·언어 사용 현황 수집
│   │
│   ├── management/commands/     # ★ Django 커스텀 관리 명령어 (python manage.py ...)
│   │   ├── fill_tables.py       # 기업·공고·게시글·매칭 더미 데이터 생성
│   │   │                        # (실행: python manage.py fill_tables)
│   │   ├── load_dataset.py      # HuggingFace 이력서/JD 데이터셋 2,640건 적재
│   │   │                        # (실행: python manage.py load_dataset)
│   │   ├── load_problems.py     # 30직군 × 200문제 JSON 파일 → DB 적재
│   │   │                        # (실행: python manage.py load_problems --problems_dir ... --paths_dir ...)
│   │   ├── seed_all.py          # fill_tables + load_dataset 한꺼번에 실행하는 통합 시드
│   │   └── sync_platforms.py    # 특정 사용자의 플랫폼 연동 데이터 CLI로 강제 동기화
│   │                            # (실행: python manage.py sync_platforms --user=email@example.com)
│   │
│   └── migrations/              # core 앱 DB 마이그레이션 이력
│       ├── 0001_initial.py      # 최초 12개 기본 테이블 생성
│       ├── 0002_...             # is_staff 컬럼 추가
│       ├── 0003_dataset_tables  # HuggingFace 데이터셋 테이블 5개 추가
│       ├── 0004_merge_...       # 충돌 마이그레이션 병합
│       ├── 0005_alter_...       # career_level 등 컬럼 수정
│       └── 0006_portfolio...    # PortfolioSnapshot, PortfolioFeedback 추가
│
└── board/                       # ★ 게시판 앱 (공지·대회·이벤트)
    ├── models.py                # (비어 있음 — 게시글 모델은 core.models.Post)
    ├── views.py                 # BoardListView (목록), BoardDetailView (상세)
    ├── urls.py                  # /api/board/ 하위 URL 정의
    ├── serializers.py           # Post → JSON 직렬화 규칙
    └── migrations/              # board 앱 마이그레이션 (현재 비어 있음)
```

---

## 5. 로컬 실행 방법 (How to Run)

### 사전 준비
- Python 3.10 이상 설치 필요
- `backend/` 폴더가 기준 경로입니다

### Step 1 — 가상환경 만들기

```bash
# 프로젝트 루트(ELAW/)에서 실행
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate
```

### Step 2 — 패키지 설치

```bash
# ELAW/ 루트에 있는 requirements.txt 사용
pip install -r requirements.txt

# requirements.txt 주요 항목:
# django                       ← 웹 프레임워크
# djangorestframework          ← REST API 구현
# djangorestframework-simplejwt ← JWT 인증
# django-cors-headers          ← 프론트엔드 CORS 허용
# python-dotenv                ← .env 파일 로드
# requests                     ← 외부 API(Gemini, GitHub) 호출
# datasets                     ← HuggingFace 데이터셋 로드용
```

### Step 3 — .env 파일 만들기

`backend/` 폴더 안에 `.env` 파일을 만들고 아래 내용을 입력합니다.

```env
# Google Gemini API 키 (AI 커리큘럼 생성에 필요)
GEMINI_API_KEY=your_gemini_api_key_here

# GitHub Personal Access Token (GitHub 데이터 수집에 필요)
GITHUB_TOKEN=your_github_token_here

# MySQL 전환 시 아래 항목 추가 (현재는 SQLite 기본 사용)
# DB_NAME=elaw_db
# DB_USER=elaw_user
# DB_PASSWORD=yourpassword
# DB_HOST=localhost
# DB_PORT=3306
```

> **Gemini API 키 발급**: https://aistudio.google.com/app/apikey

### Step 4 — 데이터베이스 초기화

```bash
# backend/ 폴더로 이동
cd backend

# 마이그레이션 생성 및 적용 (테이블 생성)
python manage.py makemigrations
python manage.py migrate
```

### Step 5 — 관리자 계정 만들기 (선택)

```bash
python manage.py createsuperuser
# 이메일, 비밀번호 입력
# 이후 http://127.0.0.1:8000/admin/ 으로 Django 관리 페이지 접근 가능
```

### Step 6 — 더미 데이터 넣기 (선택, 권장)

```bash
# 기업·공고·게시글 샘플 데이터 생성
python manage.py fill_tables

# HuggingFace 데이터셋 2,640건 적재 (시간이 걸릴 수 있음)
python manage.py load_dataset
```

### Step 7 — 서버 실행

```bash
python manage.py runserver
```

브라우저에서 http://127.0.0.1:8000/admin/ 접속 확인.

---

## 6. 전체 API 엔드포인트 목록

### 🔐 인증 관련 (`/api/accounts/`)

| 메서드 | 경로 | 설명 | 인증 필요 |
|--------|------|------|-----------|
| `POST` | `/api/accounts/signup/` | 회원가입 | ❌ |
| `POST` | `/api/accounts/login/` | 로그인 → Access/Refresh 토큰 발급 | ❌ |
| `POST` | `/api/accounts/token/refresh/` | Access 토큰 갱신 | ❌ |
| `GET`  | `/api/accounts/profile/` | 내 프로필 조회 | ✅ |
| `PATCH`| `/api/accounts/profile/` | 내 프로필 수정 (name, phone 등) | ✅ |
| `GET`  | `/api/accounts/platform/` | 연동된 플랫폼 목록 조회 | ✅ |
| `POST` | `/api/accounts/platform/` | 플랫폼 아이디 등록/수정 | ✅ |
| `POST` | `/api/accounts/platform/sync/` | 등록된 플랫폼에서 풀이 이력 수집 | ✅ |
| `GET`  | `/api/accounts/platform/status/` | 플랫폼별 수집 현황 + 취약 태그 Top5 | ✅ |

### 🎯 핵심 기능 (`/api/core/`)

| 메서드 | 경로 | 설명 | 인증 필요 |
|--------|------|------|-----------|
| `GET`  | `/api/core/goals/` | 내 현재 활성 목표 조회 | ✅ |
| `POST` | `/api/core/goals/` | 목표 등록 → Gemini AI 커리큘럼 자동 생성 | ✅ |
| `POST` | `/api/core/matches/generate/` | 활성 채용공고 전체와 AI 매칭 점수 계산 | ✅ |
| `GET`  | `/api/core/dashboard/` | 전체 현황 (목표·풀이통계·매칭·포트폴리오) | ✅ |

### 📋 게시판 (`/api/board/`)

| 메서드 | 경로 | 설명 | 인증 필요 |
|--------|------|------|-----------|
| `GET`  | `/api/board/` | 전체 게시글 목록 | ❌ |
| `GET`  | `/api/board/?category=notice` | 카테고리별 필터 (notice/contest/event) | ❌ |
| `POST` | `/api/board/` | 게시글 작성 (관리자만) | ✅ |
| `GET`  | `/api/board/<id>/` | 게시글 상세 조회 (조회수 +1) | ❌ |
| `PUT`  | `/api/board/<id>/` | 게시글 수정 (관리자만) | ✅ |
| `DELETE`| `/api/board/<id>/` | 게시글 삭제 (관리자만) | ✅ |

### 🔍 DB 조회 API (`/api/db/`) — 개발·디버깅용

| 경로 | 조회 대상 |
|------|-----------|
| `/api/db/summary/` | 전체 테이블 레코드 수 요약 |
| `/api/db/users/` | 사용자 목록 |
| `/api/db/companies/` | 기업 목록 |
| `/api/db/job-postings/` | 채용공고 목록 |
| `/api/db/matches/` | 매칭 결과 목록 |
| `/api/db/solve-history/` | 풀이 이력 |
| `/api/db/learning-stats/` | 학습 통계 |
| `/api/db/portfolios/` | 포트폴리오 목록 |
| `/api/db/posts/` | 게시글 목록 |
| `/api/db/ai-logs/` | AI 호출 기록 |

---

## 7. 인증 방법 (JWT)

이 프로젝트는 **JWT(JSON Web Token)** 방식으로 인증합니다.

### 토큰 발급

```http
POST /api/accounts/login/
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "yourpassword"
}
```

응답:
```json
{
  "access": "eyJhbGciOiJIUzI1NiIs...",   ← 60분 유효
  "refresh": "eyJhbGciOiJIUzI1NiIs..."   ← 14일 유효
}
```

### 인증이 필요한 API 요청 방법

모든 요청 헤더에 `Authorization: Bearer {access_token}` 을 포함합니다.

```http
GET /api/accounts/profile/
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Access 토큰 만료 시 갱신

```http
POST /api/accounts/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 8. 환경변수 (.env) 설정

`backend/.env` 파일에 아래 항목들을 설정합니다.

```env
# ─── AI 연동 (필수) ───────────────────────────────────
GEMINI_API_KEY=AIzaSy...          # Google Gemini API 키
GITHUB_TOKEN=ghp_...              # GitHub Personal Access Token

# ─── MySQL 전환 시 (선택) ─────────────────────────────
# 현재는 SQLite를 기본으로 사용합니다.
# MySQL로 전환하려면 아래 주석을 해제하고 settings.py도 수정하세요.
# DB_NAME=elaw_db
# DB_USER=elaw_user
# DB_PASSWORD=yourpassword
# DB_HOST=localhost
# DB_PORT=3306

# ─── 문제 데이터셋 경로 (선택) ───────────────────────
# load_problems 커맨드 실행 시 필요한 폴더 경로
# PROBLEMS_DIR=/path/to/DB/JobProblems
# PATHS_DIR=/path/to/DB/LearningPaths
```

---

## 9. 프론트엔드 연동 가이드

프론트엔드(Next.js, `frontend/`)에서 이 백엔드 API를 호출하는 방법입니다.

### 기본 URL

로컬 개발 환경에서 백엔드 서버 주소:
```
http://127.0.0.1:8000
```

### 회원가입 예시 (fetch)

```typescript
const res = await fetch("http://127.0.0.1:8000/api/accounts/signup/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
    name: "홍길동",
  }),
})
```

### 로그인 후 토큰 저장 예시

```typescript
const res = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "...", password: "..." }),
})
const { access, refresh } = await res.json()
localStorage.setItem("accessToken", access)
```

### 인증된 API 호출 예시

```typescript
const token = localStorage.getItem("accessToken")
const res = await fetch("http://127.0.0.1:8000/api/core/dashboard/", {
  headers: { Authorization: `Bearer ${token}` },
})
```

### 목표 등록 → AI 커리큘럼 생성 예시

```typescript
const res = await fetch("http://127.0.0.1:8000/api/core/goals/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    goal_type: "job",          // "job" 또는 "study"
    field: "백엔드",           // 관심 분야
    job_role: "백엔드 개발자", // 목표 직무
    duration_weeks: 12,        // 학습 기간(주)
  }),
})
// 응답에 curriculum_id 포함 → 커리큘럼이 자동 생성됨
```

---

## 자주 묻는 질문 (FAQ)

**Q. `db.sqlite3` 파일이 없다는 오류가 나요.**
→ `python manage.py migrate` 를 먼저 실행하면 자동으로 생성됩니다.

**Q. Gemini API 없이도 커리큘럼 생성이 되나요?**
→ 됩니다. Gemini 호출이 실패하면 자동으로 기본 8주 커리큘럼이 생성됩니다.

**Q. CORS 오류가 발생해요.**
→ `settings.py`의 `CORS_ALLOW_ALL_ORIGINS = True` 로 설정되어 있어 로컬 개발 시 문제없어야 합니다. 운영 환경에서는 `CORS_ALLOWED_ORIGINS` 에 프론트 도메인을 추가하세요.

**Q. 관리자 페이지는 어떻게 접근하나요?**
→ `python manage.py createsuperuser` 로 계정을 만든 후 http://127.0.0.1:8000/admin/ 에서 접속합니다.
