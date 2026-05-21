# ELAW PRD v2.0

**Product Requirements Document — 프로젝트 통합 요구사항 정의서**

| 항목 | 내용 |
|------|------|
| 프로젝트명 | ELAW (Employment-Linked Adaptive Learning & Writing) |
| 버전 | v2.0 |
| 작성일 | 2026-05-21 |
| 분류 | 캡스톤 설계 — 목포대학교 융합소프트웨어학과 |
| 참조 문서 | DB_PRD.md · backend_PRD.md · frontend_PRD.md · models_PRD.md · models_curriculum_PRD.md · models_portfolio_PRD.md |

---

## 목차

1. [WHO — 이해관계자 및 사용자](#1-who)
2. [WHAT — 제품 개요 및 기능 요구사항](#2-what)
3. [WHEN — 현재 상태 및 완료 기준](#3-when)
4. [WHERE — 시스템 범위 및 아키텍처](#4-where)
5. [WHY — 제품 목적 및 비즈니스 가치](#5-why)
6. [HOW — 기술 스택 및 구현 전략](#6-how)

---

## 1. WHO

### 1.1 개발팀 구성 및 역할

| 팀 | 담당 레이어 | 핵심 책임 |
|----|------------|----------|
| **DB 팀** | `DB/` | 스키마 설계, 5계층 21개 테이블, 6,000문제 데이터 적재, 운영 MySQL 전환 |
| **백엔드 팀** | `backend/` | Django REST API (30+ 엔드포인트), JWT 인증, AI 모델 연동, ETL |
| **프론트엔드 팀** | `frontend/` | Next.js 14개 페이지, 컴포넌트 시스템, 백엔드 API 연동 |
| **ML 팀** | `models/` | 문제 추천 파이프라인 (GKT·SAKT·DKT 앙상블), AI 포트폴리오 생성 모델 |

> 팀 간 협업 규약: 프론트엔드 코드 내 `[FE 수정 매뉴얼]` / `[BE 매뉴얼]` / `[DB 매뉴얼]` 3계층 주석으로 미구현 연동 지점을 명시.

### 1.2 최종 사용자

| 유형 | 특성 | 핵심 니즈 |
|------|------|----------|
| **학습자(student)** | 취업 준비 중인 공대생 | 목표 공고까지의 학습 경로, 맞춤 문제 추천, 포트폴리오 자동 생성 |
| **기업(company)** | 채용 담당자 | 공고 등록, 지원자 포트폴리오 열람 |
| **관리자(admin)** | 플랫폼 운영자 | 공지·이벤트 게시, 전체 데이터 모니터링 |
| **비로그인 방문자** | 신규 유입 | 서비스 소개 확인, 회원가입 유도 |

### 1.3 외부 의존 서비스

| 서비스 | 제공자 | 사용 목적 |
|--------|--------|----------|
| Gemini 2.0 Flash | Google | 개인화 커리큘럼 생성 |
| Ollama mybot | 로컬 (gemma2:2b + LoRA) | AI 포트폴리오 본문 생성 |
| solved.ac API | 공개 API | Baekjoon 풀이 이력 ETL |
| GitHub API v3 | GitHub | 언어 통계·저장소 ETL |
| HuggingFace | recuse/synthetic_resume_jd | RLHF 학습용 이력서-공고 쌍 2,640건 |

---

## 2. WHAT

### 2.1 제품 한 줄 정의

> 취업 목표 공고를 입력하면, AI가 개인화 학습 경로·문제 추천·포트폴리오 초안을 자동으로 제공하는 취업 연계 학습 플랫폼

### 2.2 핵심 기능 (Core Features)

#### F-01. 회원 인증 및 플랫폼 연동
- 이메일 기반 회원가입·로그인 (JWT, access 60분 / refresh 14일)
- Baekjoon(solved.ac), GitHub 계정 연동 및 풀이 이력 자동 동기화
- AI·개인정보 이용 동의 관리

#### F-02. 취업 목표 설정 및 AI 커리큘럼 생성
- 직군·학습 주제 2단계 위저드로 목표 설정 (최초 로그인 온보딩)
- Gemini 2.0 Flash 기반 8~12주 개인화 커리큘럼 자동 생성
- 학습 진행률 추적 (locked → in-progress → completed)

#### F-03. 채용공고 탐색 및 AI 매칭
- 30+ 엔드포인트 RESTful API로 공고 목록·상세·검색·필터
- 매칭 점수 자동 계산: `required × 0.6 + preferred × 0.25 + algo_bonus(max 15)`
- 스크랩·스터디 모드·지원 상태 관리 (`recommended → viewed → scrapped → applied`)

#### F-04. 개인화 문제 추천 시스템 ★ 핵심 AI
- **SeedQuiz**: 10문제 진단 (university×5, junior×3, middle×2)
- **Voting**: 정답률 → 3구간 판별 → GKT·SAKT·DKT 가중치 결정
- **GKT + SAKT + DKT 소프트 보팅**: 취약점 보완 + 학습 연속성 + 성취감 동시 최적화
- 풀이 후 온라인 업데이트 → 반복 추천
- 30개 직군 × 200문제 = **6,000개 자체 문제** 기반

#### F-05. AI 포트폴리오 생성 ★ 핵심 AI
- 경력 서술 + JD 입력 → Ollama mybot(gemma2:2b + LoRA) → 한국어 포트폴리오 초안 (30~120초)
- 허위 경력 생성 방지: temperature 0.2 + 엄격한 프롬프트 규칙
- 사용자 직접 편집 후 제출, RLHF 피드백 수집 → model_v2 재학습 로드맵

#### F-06. 커뮤니티 게시판
- 공지·행사·QnA 카테고리 게시판
- 관리자 전용 작성·수정·삭제, 전체 공개 열람

#### F-07. 대시보드 및 통계
- 통합 대시보드: 목표·학습 현황·매칭 상위 공고·포트폴리오 요약
- 플랫폼 연동 통계: 언어별·알고리즘 태그별 풀이 현황
- DB 관리자 API 13개 (`/api/db/*`)

### 2.3 데이터 요구사항

| 구분 | 규모 | 상태 |
|------|------|------|
| DB 테이블 | 5계층 21개 | 설계 완료 |
| 자체 문제 | 30직군 × 200문제 = 6,000개 | 데이터 완료 |
| 직군별 학습경로 | 30개 (클러스터·엣지·순서) | 데이터 완료 |
| HuggingFace 이력서-공고 쌍 | 2,640건 | 적재 스크립트 완료 |
| 채용공고 더미 데이터 | 미정 | **미완료** |

---

## 3. WHEN

### 3.1 레이어별 완료 현황

#### DB 레이어
| 항목 | 상태 |
|------|------|
| SQLite 개발 DB + migrations 0001~0006 | ✅ 완료 |
| 6,000문제 JSON (30개 직군) | ✅ 완료 |
| 30개 직군 학습경로 JSON | ✅ 완료 |
| HuggingFace 데이터 적재 스크립트 | ✅ 완료 |
| 운영 MySQL 서버 설정 | ❌ 미완료 |
| 초기 채용공고 더미 데이터 삽입 | ❌ 미완료 |

#### 백엔드 레이어
| 항목 | 상태 |
|------|------|
| accounts / board / jobs / core / db API (30+ 엔드포인트) | ✅ 완료 |
| Ollama mybot 포트폴리오 연동 | ✅ 완료 |
| Gemini 커리큘럼 생성 (폴백 포함) | ✅ 완료 |
| ETL (solved.ac, GitHub) | ✅ 완료 |
| 서버 배포 | ❌ 미완료 |
| SECRET_KEY .env 이관 | ❌ 미완료 |
| ML 문제 추천 API 연동 | ❌ 미완료 |

#### 프론트엔드 레이어
| 항목 | 상태 |
|------|------|
| 14개 페이지 스캐폴딩 + 반응형 UI | ✅ 완료 |
| shadcn/ui 컴포넌트 시스템 | ✅ 완료 |
| 백엔드 API 연동 (전체) | ❌ 미완료 |
| 인증 플로우 + 라우트 보호 미들웨어 | ❌ 미완료 |
| AI 포트폴리오 로딩 UX (30~120초) | ❌ 미완료 |

#### ML 레이어
| 항목 | 상태 |
|------|------|
| SeedQuiz + Voting + GKT/SAKT/DKT + Recommend | ✅ 완료 |
| 통합 테스트 29개 항목 (test.py) | ✅ 완료 |
| Ollama mybot 모델 파인튜닝 (LoRA) | ✅ 완료 |
| CurriculumBuilder (LearningPaths 생성) | ✅ 완료 |
| Django 백엔드 연동 (문제 추천 API) | ❌ 미완료 |
| 30개 전체 직군 end-to-end 검증 | ❌ 미완료 |

### 3.2 전체 우선순위 로드맵

#### P0 — 배포 블로커 (즉시 처리)
| # | 항목 | 담당 |
|---|------|------|
| 1 | SECRET_KEY `.env` 이관 + `DEBUG=False` | 백엔드 팀 |
| 2 | 운영 MySQL 서버 설정 + `.env` 구성 | DB 팀 |
| 3 | `python manage.py migrate` 운영 환경 실행 | DB 팀 + 백엔드 팀 |
| 4 | 운영 서버 Ollama 설치 + mybot 모델 빌드 | 백엔드 팀 |
| 5 | 프론트엔드 인증 플로우 + 라우트 보호 미들웨어 | 프론트엔드 팀 |
| 6 | 프론트엔드 AI 포트폴리오 로딩 UX (30~120초) | 프론트엔드 팀 |

#### P1 — 핵심 기능 완성
| # | 항목 | 담당 |
|---|------|------|
| 7 | 채용공고 더미 데이터 삽입 + seed_all | DB 팀 |
| 8 | 프론트엔드 채용공고·스크랩·대시보드 API 연동 | 프론트엔드 팀 |
| 9 | ML 문제 추천 Django View 연동 (SeedQuiz→Recommend) | 백엔드 팀 + ML 팀 |
| 10 | 퀴즈 세션 관리 방식 결정 (Django session vs Redis) | 백엔드 팀 |
| 11 | `problem_recommendations` 테이블 저장 연동 | 백엔드 팀 |
| 12 | CORS 도메인 제한 (현재 Allow All) | 백엔드 팀 |

#### P2 — 품질 개선
| # | 항목 | 담당 |
|---|------|------|
| 13 | `portfolio_snapshots` RLHF 피드백 수집 UI | 프론트엔드 팀 + DB 팀 |
| 14 | 30개 전체 직군 ML 파이프라인 검증 | ML 팀 |
| 15 | Ollama 타임아웃 에러 처리 개선 (현재 500) | 백엔드 팀 |
| 16 | 페이지네이션 구현 | 백엔드 팀 |
| 17 | 운영 DB 백업 정책 수립 | DB 팀 |

#### P3 — 고도화
| # | 항목 | 담당 |
|---|------|------|
| 18 | GKT 신경망 기반 고도화 (현재 규칙 기반) | ML 팀 |
| 19 | RLHF 피드백 기반 portfolio model_v2 재학습 | ML 팀 |
| 20 | GPU 서버 구성 (응답 30초 이하 목표) | 인프라 |
| 21 | 구간 경계값(60/77%) A/B 테스트 | ML 팀 |
| 22 | 영문 포트폴리오 출력 지원 | ML 팀 |

---

## 4. WHERE

### 4.1 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│  Frontend  (Next.js 16.2 / React 19 / TS)   │
│  localhost:3000  →  14개 페이지              │
└──────────────────────┬──────────────────────┘
                       │  REST / JWT Bearer
                       ▼
┌─────────────────────────────────────────────┐
│  Backend  (Django 6 + DRF / Python 3.13)    │
│  localhost:8000  /  Docker:9000             │
│  ├── /api/accounts/  (인증·플랫폼 연동)      │
│  ├── /api/jobs/      (공고·스크랩·포트폴리오)│
│  ├── /api/board/     (게시판)                │
│  ├── /api/core/      (목표·매칭·대시보드)    │
│  └── /api/db/        (관리자 조회 13개)      │
└──────┬──────────────────────────────┬───────┘
       │  Django ORM                  │  subprocess
       ▼                              ▼
┌─────────────────┐     ┌─────────────────────────┐
│  Database       │     │  Ollama (mybot)          │
│  SQLite (dev)   │     │  gemma2:2b + LoRA        │
│  MySQL (prod)   │     │  포트폴리오 생성 30~120s │
│  21개 테이블    │     └─────────────────────────┘
└─────────────────┘
       │  Python dict 주입
       ▼
┌─────────────────────────────────────────────┐
│  ML Models  (순수 Python, Django 독립)       │
│  ├── curriculum/                             │
│  │   ├── SeedQuiz  → 10문제 진단             │
│  │   ├── Voting    → 구간 판별·가중치        │
│  │   └── Recommend → GKT+SAKT+DKT 앙상블    │
│  └── portfolio/                              │
│      └── portfolio_maker.py (Ollama CLI)    │
└─────────────────────────────────────────────┘
       ↑  외부 데이터 수집
┌─────────────────────────────────────────────┐
│  ETL  (core/etl/)                           │
│  ├── solved.ac API   → SolveHistory         │
│  └── GitHub API v3   → LearningStats        │
└─────────────────────────────────────────────┘
```

### 4.2 레이어별 경계

| 레이어 | 디렉터리 | 기술 스택 | 외부 의존 |
|--------|----------|----------|----------|
| Frontend | `frontend/` | Next.js 16.2, React 19, TypeScript, Tailwind v4, shadcn/ui | 백엔드 REST API |
| Backend | `backend/` | Django 6.0.3, DRF, Simple JWT, Python 3.13 | Ollama, Gemini, solved.ac, GitHub |
| Database | `DB/` | MySQL 8.0+ (운영), SQLite (개발), utf8mb4 | HuggingFace |
| ML | `models/` | 순수 Python (Django ORM 미사용) | Ollama (로컬) |

### 4.3 데이터 흐름

```
[외부 플랫폼]                [사용자 액션]
Baekjoon / GitHub             목표 설정
     ↓ ETL                       ↓
[SolveHistory]            [UserGoal]
[LearningStats]               ↓ Gemini API
     ↓                    [Curriculum]
     └──────────┬──────────────┘
                ↓
         [Match Score]
         req×0.6 + pref×0.25 + algo(max 15)
                ↓
         [JobPosting 매칭]
                ↓ 공고 선택
         ┌──────┴──────┐
         ↓             ↓
   [SeedQuiz]   [portfolio_maker]
   10문제 진단   경력 + JD → Ollama
         ↓             ↓
   [Voting]      [Portfolio]
   [Recommend]   content_json 저장
   Top-N 추천          ↓
         ↓       [portfolio_feedback]
   [풀이 이력]    RLHF 데이터 축적
         ↓
   [재추천 반복]
```

### 4.4 환경별 설정

| 환경 | DB | 서버 포트 | Ollama |
|------|-----|---------|--------|
| 로컬 개발 | SQLite | 8000 (BE), 3000 (FE) | 로컬 실행 |
| Docker | SQLite | 9000 (BE) | 로컬 실행 |
| 운영 | MySQL 8.0+ | TBD | 동일 머신 필수 |

---

## 5. WHY

### 5.1 해결하는 문제

#### 문제 1. 채용-학습 단절
대부분의 개발자 지망생은 "어떤 것을 공부해야 하는지"를 채용공고와 연결해서 생각하지 못한다. ELAW는 목표 공고를 입력하면 요구 스킬 갭을 자동 계산하고, 거기에 맞는 학습 경로와 문제를 제공한다.

#### 문제 2. 획일적 학습 콘텐츠
수준에 관계없이 동일한 순서로 문제를 풀면 아는 내용을 반복하거나 너무 어려운 문제에 좌절하는 양극화가 발생한다. GKT·SAKT·DKT 앙상블이 취약점 보완·학습 연속성·성취감을 동시에 최적화해 이탈을 방지한다.

#### 문제 3. 포트폴리오 작성 장벽
신입 개발자에게 포트폴리오는 취업의 첫 관문이지만, 어떻게 써야 할지 몰라 지원 자체를 포기하는 경우가 많다. AI가 JD 분석 기반 첫 초안을 생성해 "어떻게 시작할지"의 장벽을 제거하고, 지원 비용을 대폭 낮춘다.

#### 문제 4. 허위 경력 생성 리스크
일반 LLM에 포트폴리오를 맡기면 그럴듯한 허구 경력을 지어낸다. ELAW는 `temperature 0.2`와 엄격한 프롬프트 규칙으로 실제 경험만 사용하도록 강제한다. 이것이 이 모델의 핵심 신뢰 가치다.

### 5.2 핵심 AI 설계 근거

#### 문제 추천 앙상블
단일 모델은 한 가지 신호만 본다:

| 모델만 사용 시 | 문제점 |
|--------------|--------|
| GKT만 사용 | 취약점만 추천 → 좌절·이탈 |
| SAKT만 사용 | 최근 공부한 것만 반복 → 새 영역 미탐색 |
| DKT만 사용 | 쉬운 문제만 추천 → 성장 정체 |

세 모델의 소프트 보팅이 **취약점 보완 + 학습 연속성 + 성취감**을 동시에 달성한다.

수준이 높을수록 GKT 가중치를 높이는 이유: 학습 수준이 높은 사용자일수록 아직 경험하지 못한 고급 개념의 선수 취약점을 선제적으로 파악하는 것이 이탈 방지보다 더 중요하기 때문이다.

#### 로컬 Ollama 선택 이유

| 기준 | 외부 API (GPT-4 등) | 로컬 Ollama |
|------|---------------------|------------|
| 운영 비용 | 토큰당 과금 | 0 |
| 데이터 보안 | 사용자 경력이 외부 전송 | 로컬 처리, 외부 미전송 |
| 커스터마이징 | 프롬프트 제한적 | LoRA 자유 적용 |
| 응답 속도 | 수초 | 30~120초 |

사용자의 개인 경력 데이터를 외부로 전송하지 않는 **데이터 보안**과 **운영 비용 0**이 결정적 이유다.

### 5.3 기술 아키텍처 선택 근거

| 선택 | 이유 |
|------|------|
| Django + DRF | 팀 친숙도, ORM·인증·시리얼라이저 생산성 |
| JWT 60분/14일 | Stateless, 모바일 확장 고려 |
| Next.js App Router | SSR/SSG 혼용, 라우트 기반 코드 스플리팅 |
| shadcn/ui | 소유권 기반 컴포넌트, Radix 접근성 |
| ML 모듈 Django 독립 | 단독 테스트 가능, 의존성 없는 순수 Python |
| 관계형 DB로 그래프 관리 | `problem_edges` 테이블로 그래프 DB 없이 선수과목 쿼리 |
| JSON 컬럼 활용 | 커리큘럼·스킬·RLHF 레이블 등 유연한 구조 변경 수용 |

---

## 6. HOW

### 6.1 전체 기술 스택

| 레이어 | 기술 |
|--------|------|
| **Frontend** | Next.js 16.2, React 19, TypeScript 5.7, Tailwind CSS v4, shadcn/ui, React Hook Form, Zod |
| **Backend** | Python 3.13, Django 6.0.3, DRF, Simple JWT, django-cors-headers |
| **Database** | SQLite (개발) / MySQL 8.0+ utf8mb4 (운영) |
| **ML - 추천** | 순수 Python (GKT·SAKT·DKT, Sentence-BERT 임베딩) |
| **ML - 포트폴리오** | Ollama, gemma2:2b, LoRA (GGUF), temperature 0.2 |
| **AI - 커리큘럼** | Gemini 2.0 Flash (Google) |
| **인프라** | Docker, docker-compose (포트 9000) |

### 6.2 핵심 사용자 시나리오별 흐름

#### 시나리오 A. 신규 학습자 온보딩
```
회원가입 → 로그인 (JWT 발급) → is_first_login=true
  ↓
/goal-setting 2단계 위저드
  직군 선택 → 학습 주제 선택
  ↓
POST /api/core/goals/ → Gemini 커리큘럼 자동 생성
  ↓
/home 대시보드 (추천 공고·학습 진도)
```

#### 시나리오 B. 채용공고 → 학습 → 포트폴리오
```
GET /api/jobs/ → 공고 탐색 (매칭 점수 확인)
  ↓
GET /api/jobs/<id>/ → 공고 상세
  ↓
POST /api/jobs/<id>/study/ → 스터디 목표 생성
  (409 시 ?force=true 재요청)
  ↓
POST /api/jobs/<id>/apply/ → AI 포트폴리오 생성
  └─ Ollama mybot (30~120초) → Portfolio 저장
  ↓
PATCH /api/jobs/portfolios/<id>/ → 편집 후 저장
```

#### 시나리오 C. 문제 추천 학습 (ML 연동 후)
```
직군 선택 → DB에서 problems + ordered_path 로드
  ↓
SeedQuiz 10문제 진단 (university×5, junior×3, middle×2)
  ↓
Voting → 정답률 → zone (낮음/괜찮음/높음) → 가중치
  ↓
Recommend (GKT+SAKT+DKT 소프트 보팅) → Top-5 추천
  total = w_GKT×GKT + w_SAKT×SAKT + w_DKT×DKT
  ↓
풀이 → update() → 재추천 반복
```

#### 시나리오 D. 플랫폼 연동 및 스킬 갭 분석
```
POST /api/accounts/platform/ → Baekjoon / GitHub 연동
  ↓
POST /api/accounts/platform/sync/ → ETL 트리거
  solved.ac API → SolveHistory
  GitHub API  → LearningStats (언어 통계)
  ↓
POST /api/core/matches/generate/ → 매칭 점수 계산
  required×0.6 + preferred×0.25 + algo_bonus
  ↓
GET /api/core/dashboard/ → 통합 현황 확인
```

### 6.3 운영 배포 체크리스트

#### 백엔드 (P0 필수)
- [ ] `SECRET_KEY` settings.py → `.env` 이관
- [ ] `DEBUG = False` 설정
- [ ] `CORS_ALLOW_ALL_ORIGINS = False`, 허용 도메인 명시
- [ ] `ALLOWED_HOSTS` 운영 도메인 등록
- [ ] `.env` 변수: `GEMINI_API_KEY`, `GITHUB_TOKEN`, `SECRET_KEY`, DB 접속 정보

#### 데이터베이스 (P0 필수)
- [ ] MySQL 8.0+ 서버 설치 및 DB/User 생성
- [ ] `.env` DB 접속 정보 설정
- [ ] `python manage.py migrate`
- [ ] `python manage.py seed_all`
- [ ] `python manage.py load_problems` (전체 30직군)
- [ ] `python manage.py load_dataset` (HuggingFace)
- [ ] 채용공고 더미 데이터 삽입

#### Ollama (P0 필수)
- [ ] 백엔드 서버에 Ollama 설치
- [ ] `ollama pull gemma2:2b`
- [ ] `ollama create mybot -f models/portfolio/Modelfile`
- [ ] `ollama list | grep mybot` 확인 (1.6 GB 이상)

#### 프론트엔드 (P0 필수)
- [ ] 인증 미들웨어(`middleware.ts`) 구현
- [ ] `useAuth()` 전역 훅 + 토큰 자동 갱신 인터셉터
- [ ] AI 포트폴리오 로딩 오버레이 (130초 타임아웃)
- [ ] 스터디 모드 409 처리 다이얼로그

### 6.4 팀 간 인터페이스 규약

#### API 응답 에러 코드
| 코드 | 의미 | 주요 발생 상황 |
|------|------|--------------|
| 400 | Bad Request | 입력 유효성 오류 |
| 401 | Unauthorized | 토큰 없음·만료 → FE에서 자동 갱신 |
| 403 | Forbidden | 권한 부족 (본인 외, staff 아님) |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 스터디 모드 중복 → `?force=true` 재요청 |
| 500 | Server Error | Ollama 타임아웃, 외부 API 오류 |

#### ML 모듈 데이터 주입 계약
ML 모듈(`curriculum/`)은 Django ORM을 직접 import하지 않는다. 백엔드 View가 아래 형식으로 데이터를 주입한다:

```python
# 백엔드 View → ML 모듈 주입 형식
problems = {
    question_id: {
        "question_id": int, "difficulty": str, "category": str,
        "subcategory": str, "question": str, "choices": list,
        "correct_answer": str, "explanation": str
    }
}
ordered_path     = list[int]          # 선수과목 순서 정렬
dependency_graph = {"nodes": [...], "edges": [...]}
```

#### 프론트엔드 협업 주석 규약
미구현 API 연동 지점에 아래 3계층 주석을 유지한다:

```typescript
// [FE 수정 매뉴얼] 하드코딩 배열을 useEffect + fetch로 교체
// [BE 매뉴얼] GET /api/jobs/ → { id, title, company, match_score }[]
// [DB 매뉴얼] job_postings: id, title, company_id, required_skills(JSON)
```

### 6.5 RLHF 고도화 로드맵 (포트폴리오 모델)

```
현재 — model_v1
  gemma2:2b + LoRA (my_portfolio_adapter.gguf)
  ↓
단계 1. 사용자 피드백 수집
  portfolio_feedback: rating(1~5), edited_content, rlhf_labels
  (used_for_training = False)
  ↓
단계 2. 배치 추출
  RLHFCollector.extract_training_batch()
  → used_for_training = True 마킹
  ↓
단계 3. 재학습 — model_v2
  피드백 데이터로 LoRA 어댑터 재학습
  → my_portfolio_adapter_v2.gguf
  ↓
단계 4. A/B 테스트
  portfolio_snapshots.generation_method = "model_v2"
  품질 비교 후 전체 전환
```

---

*본 문서는 각 레이어별 PRD(DB_PRD.md, backend_PRD.md, frontend_PRD.md, models_PRD.md, models_curriculum_PRD.md, models_portfolio_PRD.md)를 통합한 프로젝트 수준 요구사항 정의서입니다.*
