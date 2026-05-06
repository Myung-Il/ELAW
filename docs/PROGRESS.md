# ELAW 프로젝트 진행 현황

> 최종 업데이트: 2026-05-06  
> 목표: 취업 준비 AI 학습 플랫폼 — 문제 추천(BKT/DKT) + AI 커리큘럼 + 채용 매칭을 하나의 파이프라인으로 통합

---

## 목차

1. [시스템 구조](#1-시스템-구조)
2. [백엔드 진행도](#2-백엔드-진행도)
3. [프론트엔드 진행도](#3-프론트엔드-진행도)
4. [AI / ML 모델 진행도](#4-ai--ml-모델-진행도)
5. [데이터베이스 현황](#5-데이터베이스-현황)
6. [API 엔드포인트 목록](#6-api-엔드포인트-목록)
7. [완료된 작업](#7-완료된-작업)
8. [남은 작업 및 개선 사항](#8-남은-작업-및-개선-사항)
9. [알려진 버그 및 제약](#9-알려진-버그-및-제약)
10. [로컬 실행 방법](#10-로컬-실행-방법)

---

## 1. 시스템 구조

```
ELAW/
├── backend/               Django REST API (Port 9000)
│   ├── accounts/          회원가입 · 로그인 · 프로필
│   ├── board/             커뮤니티 게시판
│   ├── core/
│   │   ├── models*.py     ORM 모델 (User, JobProblem, Curriculum, ...)
│   │   ├── services/      서비스 레이어 (추천 · 스킬갭 · 포트폴리오)
│   │   ├── etl/           외부 플랫폼 수집기 (백준 · GitHub)
│   │   ├── views_user.py  목표 · 대시보드 · 매칭 API
│   │   ├── views_solve.py 문제 풀기 · 추천 · 스킬갭 · 포트폴리오 API
│   │   ├── views_db.py    DB 조회 API (관리용)
│   │   └── signals.py     자동 캐스케이드 (풀이 → 스킬갭 재계산)
│   └── config/            Django 설정 · URL 라우팅
│
├── frontend/              Next.js 16 App Router (Port 3000)
│   ├── app/               페이지 라우트
│   ├── components/        공통 UI 컴포넌트 (shadcn/ui)
│   └── lib/
│       ├── api.ts         공통 API 클라이언트 (JWT 자동 주입)
│       └── utils.ts       tailwind-merge cn() 유틸리티
│
├── models/                AI 모델 (독립 Python 모듈)
│   ├── recommender.py     BKT 기반 문제 추천 엔진
│   └── dkt.py             DKT (LSTM) 심화 추천 (torch 필요)
│
├── DB/
│   ├── JobProblems/       직무별 문제 JSON (30개 직무, 5,855문제)
│   └── LearningPaths/     학습 경로 그래프 JSON (30개)
│
└── docker-compose.yml     백엔드 + 프론트엔드 통합 실행
```

**기술 스택**

| 영역 | 기술 |
|------|------|
| 백엔드 | Python 3.14, Django 6.0.5, DRF, SimpleJWT |
| 프론트엔드 | Next.js 16.2, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| 데이터베이스 | SQLite (개발) / MySQL 전환 가능 |
| AI | BKT (Bayesian Knowledge Tracing), DKT (LSTM), Gemini 2.0 Flash |
| 인프라 | Docker Compose |

---

## 2. 백엔드 진행도

### ✅ 완료

#### 인증 (accounts/)
- [x] 회원가입 `POST /api/accounts/signup/`
- [x] JWT 로그인 `POST /api/accounts/login/`
- [x] 토큰 갱신 `POST /api/accounts/token/refresh/`
- [x] 프로필 조회/수정 `GET|PATCH /api/accounts/profile/`
- [x] 플랫폼 연동 등록 `POST /api/accounts/platform/`
- [x] 플랫폼 동기화 `POST /api/accounts/platform/sync/`

#### 목표 · 커리큘럼 (core/)
- [x] 목표 등록 + Gemini AI 커리큘럼 자동 생성 `POST /api/core/goals/`
- [x] 목표 조회 (content_json.weeks 포함) `GET /api/core/goals/`
- [x] 대시보드 (풀이통계 · 취약태그 · 매칭 Top3 · 언어통계) `GET /api/core/dashboard/`

#### 문제 풀기 파이프라인 (core/)
- [x] 문제 목록 조회 (필터 · 페이지네이션) `GET /api/core/problems/`
- [x] 문제 풀기 + BKT mastery 계산 + XP 지급 `POST /api/core/problems/<id>/solve/`
- [x] AI 추천 (BKT/DKT 하이브리드, ProblemEdge centrality) `GET /api/core/recommendations/`
- [x] 스킬갭 조회 `GET /api/core/skill-gaps/`
- [x] 포트폴리오 생성 (Gemini) `POST /api/core/portfolio/generate/`
- [x] 포트폴리오 피드백 `POST /api/core/portfolio/feedback/`

#### 채용 매칭 (core/)
- [x] AI 매칭 점수 계산 + 저장 `POST /api/core/matches/generate/`

#### 게시판 (board/)
- [x] 게시글 목록 · 조회 · 작성 · 수정 · 삭제

#### DB 관리 API (db/)
- [x] 12개 테이블 전체 조회 + 요약 통계

#### ETL 수집기
- [x] `BaekjoonCollector` — solved.ac API 연동
- [x] `GitHubCollector` — GitHub REST API 연동

#### 시그널 자동화
- [x] `JobProblemSolveHistory` 저장 → SkillGap 자동 재계산
- [x] `PlatformLink` 저장 → ETL 자동 동기화

#### 데이터 로딩
- [x] `python manage.py load_problems` — 30개 직무 JSON → DB 로딩

### ⬜ 미완료

- [ ] 채용 공고 데이터 입력 (JobPosting 테이블 비어있음)
- [ ] 실제 Company 계정 등록 흐름
- [ ] 비밀번호 변경 API `PUT /api/accounts/me/password`
- [ ] 회원 탈퇴 API `DELETE /api/accounts/me`
- [ ] 포트폴리오 공개 URL 조회 `GET /api/portfolio/<slug>/`
- [ ] 관리자 어드민 커스터마이징

---

## 3. 프론트엔드 진행도

### ✅ 완료 (API 연결 포함)

| 페이지 | 경로 | API 연결 | 상태 |
|--------|------|----------|------|
| 랜딩 | `/` | - | ✅ |
| 로그인 | `/login` | `api.login()` + JWT 저장 | ✅ |
| 회원가입 | `/register` | `api.signup()` | ✅ |
| 목표 설정 | `/goal-setting` | `api.createGoal()` | ✅ |
| 홈/대시보드 | `/dashboard` | `api.getDashboard()` | ✅ |
| AI 학습 | `/study` | `api.getRecommendations()` + `api.solveProblem()` | ✅ |
| 커리큘럼 | `/curriculum` | `api.getGoals()` (content_json.weeks) | ✅ |
| 기업 공고 | `/jobs` | `api.getJobPostings()` + `api.generateMatches()` | ✅ |
| 프로필 | `/profile` | `api.getProfile()` + `api.getDashboard()` | ✅ |
| 게시판 | `/board` | (구현 중) | ⚠️ |
| 공통 API 클라이언트 | `lib/api.ts` | JWT 자동 주입 + 401 refresh retry | ✅ |

### ⬜ 미완료

- [ ] `/board` — 게시글 목록/상세 API 연결 (현재 하드코딩)
- [ ] `/home` — 별도 홈 화면 (현재 dashboard 리다이렉트)
- [ ] `/jobs/[id]` — 공고 상세 + 스킬갭 + 포트폴리오 생성
- [ ] `/jobs/[id]/apply` — 지원 플로우
- [ ] 로그인 상태 유지 (rememberMe → refresh token 영속)
- [ ] 전역 로그아웃 처리 (auth.clear() 후 /login 리다이렉트)

---

## 4. AI / ML 모델 진행도

### BKT (Bayesian Knowledge Tracing)
- [x] `models/recommender.py` — 순수 Python BKT 구현
- [x] 풀이 이력 history replay로 상태 재구성 (파일 대신 ORM)
- [x] `ProblemEdge` centrality 가중치 반영
- [x] `models/dkt.py` — LSTM DKT 구현 (torch 필요, 없으면 BKT fallback)

### Gemini AI 연동
- [x] 커리큘럼 자동 생성 (`views_user.py` → `call_gemini()`)
- [x] 포트폴리오 자동 생성 (`services/portfolio_service.py`)
- [x] Gemini 실패 시 rule-based fallback 구현
- [x] AiLog 자동 기록 (feature, latency, tokens)

### 데이터
- [x] 직무별 문제 5,855개 로딩 완료
- [x] 문제 클러스터 5,214개
- [x] 문제 간 선수관계(ProblemEdge) 15,323개
- [x] 학습 경로 메타 30개 (직무별)

---

## 5. 데이터베이스 현황

> 2026-05-06 기준 (개발 SQLite)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| users | 1 | 테스트 계정 |
| user_goals | 1 | Backend Developer |
| curricula | 1 | Gemini fallback 8주 |
| job_problems | **5,855** | 30개 직무 로딩 완료 |
| job_problem_clusters | 5,214 | |
| problem_edges | **15,323** | 선수관계 그래프 |
| learning_path_meta | 30 | 직무별 1개 |
| problem_recommendations | 6 | 테스트 추천 결과 |
| job_problem_solve_history | 2 | 테스트 풀이 기록 |
| job_postings | 0 | **⚠️ 데이터 미입력** |
| ai_logs | 1 | Gemini 호출 기록 |
| 나머지 | 0 | companies, matches, portfolios 등 |

---

## 6. API 엔드포인트 목록

### 인증 (`/api/accounts/`)

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `signup/` | 회원가입 |
| POST | `login/` | 로그인 (JWT 발급) |
| POST | `token/refresh/` | 토큰 갱신 |
| GET/PATCH | `profile/` | 프로필 조회/수정 |
| POST | `platform/` | 플랫폼 연동 등록 |
| POST | `platform/sync/` | 플랫폼 데이터 동기화 |

### 핵심 기능 (`/api/core/`)

| Method | 경로 | 설명 |
|--------|------|------|
| GET/POST | `goals/` | 목표 조회/등록 (커리큘럼 자동 생성) |
| GET | `dashboard/` | 전체 현황 대시보드 |
| POST | `matches/generate/` | AI 채용 매칭 점수 계산 |
| GET | `problems/` | 문제 목록 (필터·페이지네이션) |
| POST | `problems/<id>/solve/` | 문제 풀기 (BKT mastery + XP) |
| GET | `recommendations/` | AI 추천 문제 (BKT/DKT) |
| GET | `skill-gaps/` | 스킬 갭 조회 |
| POST | `portfolio/generate/` | Gemini 포트폴리오 생성 |
| POST | `portfolio/feedback/` | 포트폴리오 피드백 |

### DB 관리 (`/api/db/`)

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `summary/` | 전체 테이블 건수 요약 |
| GET | `users/`, `companies/`, ... | 테이블별 전체 조회 (12개) |

### 게시판 (`/api/board/`)

| Method | 경로 | 설명 |
|--------|------|------|
| GET/POST | `/` | 게시글 목록/작성 |
| GET/PUT/DELETE | `/<id>/` | 게시글 상세/수정/삭제 |

---

## 7. 완료된 작업

### Phase 1 — DB 데이터 로딩
- `load_problems` 관리 명령어: 30개 직무 ROLE_FILE_MAP 완성, UTF-8 인코딩 처리, 선수관계 그래프 로딩

### Phase 2 — AI 서비스 레이어
- `recommender_service.py`: ORM 기반 BKT 재구성, DKT fallback, ProblemEdge centrality
- `skill_gap_service.py`: LearningStats 기반 3-tier 스킬 수준 계산
- `portfolio_service.py`: Gemini 포트폴리오 생성 + rule-based fallback

### Phase 3 — 새 API 뷰
- `views_solve.py`: 6개 엔드포인트 신규 구현
- `config/urls.py`: 라우팅 등록

### Phase 4 — 시그널 자동화
- 풀이 저장 → SkillGap 자동 재계산 (`signals.py`)
- PlatformLink 저장 → ETL 자동 실행

### Phase 5 — 프론트엔드 API 연결
- `lib/api.ts`: JWT 자동 주입 + 401 refresh retry 공통 클라이언트
- `lib/utils.ts`: tailwind-merge cn() 유틸리티
- 9개 페이지 API 연결 완료 (login, register, goal-setting, dashboard, study, curriculum, jobs, profile)
- `dashboard/page.tsx`: 하드코딩 배열 5개 제거, API 데이터로 교체

### Phase 6 — Docker & 환경 정리
- `docker-compose.yml`: frontend 서비스 추가
- `frontend/Dockerfile`: Next.js 프로덕션 빌드
- `.env.example`: 환경 변수 문서화
- `DB/core/` 중복 모델 파일 4개 제거 (`git rm`)

### 버그 수정
- `recommender_service.py` 경로: `../../../../models` → `../../../models`
- `dkt.py` torch 미설치 시 `NameError` → `except Exception` 폴백
- `login/page.tsx` `rememberMe` 상태 미선언 버그
- `register/page.tsx` `userId` 필드 잔재 제거

---

## 8. 남은 작업 및 개선 사항

### 높은 우선순위

- [ ] **채용 공고 데이터 입력** — JobPosting, Company 더미 데이터 또는 실제 공고 스크래핑
- [ ] **`/jobs/[id]/` 상세 페이지** — 공고 상세 + 스킬갭 시각화 + 포트폴리오 생성 버튼
- [ ] **게시판 API 연결** — `/board` 페이지 하드코딩 제거
- [ ] **로그아웃 처리** — `auth.clear()` + `/login` 리다이렉트 (현재 AppHeader에 미구현)

### 중간 우선순위

- [ ] **DKT 활성화** — `pip install torch` 후 30개+ 풀이 시 자동 전환 검증
- [ ] **백준/GitHub ETL 테스트** — 실제 계정 연동 후 LearningStats 수집 확인
- [ ] **Gemini 커리큘럼 품질 개선** — 현재 Gemini API 키 미설정으로 fallback 동작 중
- [ ] **XP 시스템 확장** — 연속 학습 보너스, 레벨업, 랭킹

### 낮은 우선순위

- [ ] MySQL 전환 (`settings.py` 주석 해제 + `.env` 설정)
- [ ] 포트폴리오 공개 URL (`/portfolio/<slug>/`)
- [ ] 비밀번호 변경 · 회원 탈퇴 API
- [ ] 관리자 어드민 커스터마이징
- [ ] CI/CD 파이프라인 (GitHub Actions)

---

## 9. 알려진 버그 및 제약

| 항목 | 내용 | 해결 방법 |
|------|------|----------|
| DKT 비활성화 | torch 미설치로 BKT만 동작 | `pip install torch` 설치 |
| Gemini 비활성화 | `.env`에 `GEMINI_API_KEY` 미설정 시 fallback 커리큘럼 사용 | `.env`에 키 추가 |
| 채용 공고 없음 | JobPosting 테이블 비어있음 | 더미 데이터 또는 공고 수집 필요 |
| SQLite 단일 쓰기 | `load_problems` 실행 중 서버 동시 접근 시 `database is locked` | 서버 종료 후 실행 또는 MySQL 전환 |
| 전화번호 미인증 | 회원가입 인증 요청 버튼 미구현 | SMS API 연동 필요 |

---

## 10. 로컬 실행 방법

### 사전 준비

```bash
# Python 패키지 설치
pip install -r requirements.txt

# (선택) AI 추천 DKT 활성화
pip install torch

# 환경 변수 설정
cp .env.example backend/.env
# .env에 GEMINI_API_KEY 입력
```

### 백엔드 실행

```bash
cd backend

# 최초 1회: DB 초기화
python manage.py migrate

# 최초 1회: 문제 데이터 로딩 (5,855개)
python manage.py load_problems

# 서버 실행
python manage.py runserver 9000
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Docker Compose (통합 실행)

```bash
docker-compose up --build
# 백엔드: http://localhost:9000
# 프론트엔드: http://localhost:3000
```

### 테스트 계정 생성

```bash
# API 호출로 계정 생성
curl -X POST http://localhost:9000/api/accounts/signup/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@elaw.kr","password":"Test1234!","name":"테스터","role":"student","ai_consent":true,"privacy_consent":true}'
```

---

*이 문서는 Claude Code에 의해 자동 생성되었습니다.*
