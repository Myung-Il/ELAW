# ELAW 프로젝트 개발 가이드

> 이 문서는 Claude Code가 프로젝트를 이해하고 일관된 방식으로 작업하기 위한 핵심 참고 문서입니다.
> 모든 개발 규칙, 컨벤션, 금지 사항, 설계 방식이 이곳에 집약되어 있습니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 요약](#2-기술-스택-요약)
3. [디렉터리 구조](#3-디렉터리-구조)
4. [반드시 지켜야 할 규칙](#4-반드시-지켜야-할-규칙)
5. [절대 하면 안 되는 것](#5-절대-하면-안-되는-것)
6. [코드 컨벤션](#6-코드-컨벤션)
7. [설계 방식 및 아키텍처 패턴](#7-설계-방식-및-아키텍처-패턴)
8. [프론트엔드 개발 가이드](#8-프론트엔드-개발-가이드)
9. [백엔드 개발 가이드](#9-백엔드-개발-가이드)
10. [API 연동 패턴](#10-api-연동-패턴)
11. [데이터베이스 구조 요약](#11-데이터베이스-구조-요약)
12. [환경변수 설정](#12-환경변수-설정)
13. [개발 워크플로우](#13-개발-워크플로우)

---

## 1. 프로젝트 개요

**ELAW**는 취업 준비생을 위한 AI 기반 학습 관리 + 취업 매칭 플랫폼입니다.
목포대학교 소프트웨어공학팀 캡스톤 프로젝트입니다.

### 핵심 플로우

```
회원가입/로그인
    ↓
외부 플랫폼 연동 (백준, GitHub)
    ↓
ETL: 풀이 이력·언어 통계 자동 수집
    ↓
Gemini AI: 커리큘럼 생성 → 취약점 분석 → 매칭 점수 계산
    ↓
프론트엔드 JSON API로 제공
```

---

## 2. 기술 스택 요약

### 프론트엔드

| 항목 | 버전/내용 |
|------|-----------|
| Framework | **Next.js 16.2** (App Router) |
| Runtime | **React 19** + **TypeScript 5.7** |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix UI) |
| Form | **React Hook Form 7.54** + **Zod 3.24** |
| Charts | **Recharts 2.15** |
| Icons | **lucide-react** |
| 상태 관리 | React 기본 훅 (useState, useEffect) — 별도 라이브러리 없음 |

### 백엔드

| 항목 | 버전/내용 |
|------|-----------|
| Framework | **Django 6.0** + **Django REST Framework** |
| Language | Python 3.10+ |
| 인증 | **JWT** (djangorestframework-simplejwt) |
| AI | **Google Gemini 2.0 Flash** API |
| DB (개발) | **SQLite3** |
| DB (운영) | **MySQL 8.0** (전환 가능) |
| CORS | django-cors-headers |

---

## 3. 디렉터리 구조

```
ELAW/
├── frontend/                  ← Next.js 프론트엔드 (팀 전용)
│   ├── app/                   ← App Router 페이지
│   │   ├── page.tsx           ← 랜딩 (비로그인)
│   │   ├── login/
│   │   ├── register/
│   │   ├── goal-setting/      ← 최초 로그인 후 목표 설정
│   │   ├── home/              ← 메인 대시보드 (로그인 후)
│   │   ├── jobs/[id]/
│   │   ├── curriculum/
│   │   ├── study/
│   │   ├── board/[id]/
│   │   └── profile/
│   ├── components/
│   │   ├── ui/                ← shadcn/ui 컴포넌트 (수정 금지)
│   │   └── layout/            ← 커스텀 레이아웃 컴포넌트
│   ├── hooks/                 ← 커스텀 훅
│   └── lib/                   ← 유틸리티 (utils.ts)
│
├── backend/                   ← Django REST API
│   ├── config/                ← 전역 설정 (settings.py, urls.py)
│   ├── accounts/              ← 인증·사용자 관리
│   ├── core/                  ← 핵심 비즈니스 로직
│   │   ├── etl/               ← 외부 플랫폼 데이터 수집
│   │   └── management/commands/ ← 커스텀 Django 명령어
│   └── board/                 ← 게시판
│
├── DB/                        ← DB 스키마, 시드 데이터
│   ├── JobProblems/           ← 30직군 × 200문제 (JSON)
│   ├── LearningPaths/         ← 직군별 학습 경로
│   └── sql/                   ← MySQL 스키마 정의
│
├── models/                    ← Python AI/ML 모델 (DKT, 추천)
├── docs/                      ← 문서
└── docker-compose.yml
```

---

## 4. 반드시 지켜야 할 규칙

### 4-1. 프론트엔드

- **`components/ui/` 폴더는 shadcn/ui 자동 생성 파일이므로 절대 직접 수정하지 않는다.**
  수정이 필요하면 해당 컴포넌트를 `components/` 하위에 래핑(Wrapper)하여 사용한다.

- **인증이 필요한 모든 API 요청에는 반드시 `Authorization: Bearer {token}` 헤더를 포함한다.**

- **JWT Access 토큰은 localStorage에 `accessToken` 키로 저장하고, 만료(60분) 시 `/api/accounts/token/refresh/`로 갱신한다.**

- **페이지 간 인증 상태는 `hooks/use-auth.ts`의 `useAuth()` 훅을 통해서만 확인한다.**
  - 로그인 상태: `isLoggedIn`
  - 로그인 시: `saveAuthState(name, dept, token)` 호출
  - 로그아웃 시: `clearAuthState()` 호출

- **Tailwind 클래스 병합은 반드시 `lib/utils.ts`의 `cn()` 함수를 사용한다.**
  ```typescript
  import { cn } from "@/lib"
  className={cn("기본클래스", condition && "조건클래스")}
  ```

- **폼 검증은 반드시 React Hook Form + Zod 조합으로 처리한다.**

- **현재 하드코딩된 더미 데이터는 `// TODO:` 또는 `// [FE 수정 매뉴얼]` 주석으로 표시한다.**

### 4-2. 백엔드

- **모든 비즈니스 모델은 `core/models.py`(및 `models_*.py`)에서 정의한다.** `accounts/models.py`와 `board/models.py`는 비워두고 core에 있는 모델을 참조한다.

- **커스텀 사용자 모델은 `core.User`다.** `settings.py`의 `AUTH_USER_MODEL = 'core.User'` 를 변경하지 않는다.

- **모든 API 응답은 DRF 표준 응답 구조를 따른다.**
  - 성공: `{ "status": "success", "data": {...} }`
  - 실패: `{ "status": "error", "message": "...", "errors": {...} }`

- **AI 호출(Gemini)은 반드시 `AiLog` 모델에 기록한다.** (토큰 수, 지연 시간, 비용 포함)

- **마이그레이션 파일은 직접 편집하지 않는다.** 모델 변경 후 `python manage.py makemigrations`로 자동 생성한다.

- **JWT 설정을 임의로 변경하지 않는다.** Access 60분, Refresh 14일이 현재 팀 합의 값이다.

- **`/api/db/` 엔드포인트는 개발·디버깅 전용이다.** 운영 배포 전 반드시 비활성화하거나 권한을 제한해야 한다.

### 4-3. 공통

- **코드 주석 태그 규칙을 반드시 준수한다.**
  - `[FE 수정 매뉴얼]` — 프론트엔드 팀이 구현/수정해야 할 부분
  - `[BE 매뉴얼]` — 백엔드 팀에 필요한 API 명세
  - `[DB 매뉴얼]` — DB 팀에 필요한 테이블/컬럼 정보
  - `TODO:` — 임시 코드, 실제 구현으로 교체 필요

- **환경변수(`.env`)는 절대 git에 커밋하지 않는다.** `.gitignore`에 포함되어 있음을 항상 확인한다.

- **개발자가 작업을 원한 프로젝트 부분에서 필요없는 폴더,파일,코드 등을 삭제 및 수정, 최적화를 진행한다.**
---

## 5. 절대 하면 안 되는 것

### 프론트엔드

- `components/ui/` 하위 파일 직접 수정 금지 (shadcn/ui 관리 파일)
- 인증 토큰을 sessionStorage 이외의 방식으로 저장하는 것 금지 (현재 localStorage 사용 중 — 향후 보안 개선 예정)
- TypeScript `any` 타입을 남발하는 것 금지 (`next.config.mjs`에 `ignoreBuildErrors: true`가 있더라도 개발 시에는 타입 안전성을 유지해야 함)
- shadcn/ui 컴포넌트를 import 없이 JSX에서 직접 HTML로 대체하는 것 금지 (디자인 일관성 파괴)
- 페이지 컴포넌트에서 직접 fetch 로직을 500줄 이상 넣는 것 금지 (커스텀 훅으로 분리)

### 백엔드

- `SECRET_KEY`를 코드에 하드코딩하여 커밋하는 것 금지 (운영 배포 시 반드시 환경변수로 교체)
- `DEBUG = True`인 채로 운영 배포 금지
- `CORS_ALLOW_ALL_ORIGINS = True`인 채로 운영 배포 금지 — `CORS_ALLOWED_ORIGINS`에 허용 도메인만 지정
- `core.User` 대신 Django 기본 `auth.User`를 사용하는 것 금지
- 마이그레이션 파일을 수동으로 편집하거나 삭제하는 것 금지
- Gemini API 키를 코드에 하드코딩하는 것 금지

### 공통

- `.env` 파일을 git에 추가하는 것 금지
- `DB/JobProblems/`의 JSON 데이터를 직접 편집하는 것 금지 (6,000건 데이터는 시드 스크립트로만 관리)
- DB 마이그레이션 없이 모델 필드를 직접 추가/삭제하는 것 금지

---

## 6. 코드 컨벤션

### 프론트엔드 (TypeScript/React)

#### 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `PublicHeader`, `AppHeader` |
| 파일명 (컴포넌트) | kebab-case | `public-header.tsx`, `app-header.tsx` |
| 파일명 (훅) | `use-` 접두어 + kebab-case | `use-auth.ts`, `use-toast.ts` |
| 함수/변수 | camelCase | `saveAuthState`, `accessToken` |
| 상수 | UPPER_SNAKE_CASE | `BASE_URL`, `TOKEN_KEY` |
| 라우트 경로 | kebab-case | `/goal-setting`, `/job-postings` |
| 동적 라우트 | 대괄호 + camelCase | `[id]`, `[postId]` |

#### 파일 구조 (컴포넌트 내부 순서)

```typescript
// 1. import (외부 라이브러리 → 내부 모듈 순서)
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"

// 2. 타입/인터페이스 정의
interface Props { ... }

// 3. 컴포넌트 함수 (default export)
export default function MyPage() {
  // 3-1. 훅 호출
  // 3-2. 상태 선언
  // 3-3. 이벤트 핸들러
  // 3-4. useEffect
  // 3-5. JSX return
}
```

#### import 경로

- 절대 경로 `@/`를 사용한다. (`@/*` → `./` 매핑)
  ```typescript
  import { cn } from "@/lib/utils"
  import { useAuth } from "@/hooks/use-auth"
  import { Button } from "@/components/ui/button"
  ```

### 백엔드 (Python/Django)

#### 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `GoalView`, `BoardListView` |
| 함수/변수 | snake_case | `get_user_goals`, `access_token` |
| 모델 필드 | snake_case | `goal_type`, `job_role`, `duration_weeks` |
| URL 패턴 | kebab-case | `goal-setting/`, `platform/sync/` |
| 시리얼라이저 | `ModelNameSerializer` | `UserSerializer`, `PostSerializer` |
| 뷰 (APIView) | `ActionNameView` | `GoalView`, `MatchGenerateView` |
| 관리 명령어 | snake_case 파일명 | `fill_tables.py`, `load_problems.py` |

#### 뷰 구조 (DRF APIView)

```python
class ExampleView(APIView):
    permission_classes = [IsAuthenticated]  # 인증 필요 여부 명시

    def get(self, request):
        # 로직
        return Response({"status": "success", "data": data})

    def post(self, request):
        serializer = ExampleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        # 저장 로직
        return Response({"status": "success", "data": result}, status=status.HTTP_201_CREATED)
```

---

## 7. 설계 방식 및 아키텍처 패턴

### 전체 아키텍처

```
[Next.js Frontend]
    ↓ fetch() + JWT Bearer Token
[Django REST API]
    ├── accounts/ — 인증·사용자
    ├── core/ — 핵심 로직 (AI 연동, 매칭, 대시보드)
    └── board/ — 게시판
    ↓
[SQLite3 / MySQL]
    +
[Google Gemini 2.0 Flash API]
    +
[solved.ac API + GitHub API]
```

### 인증 플로우

```
1. POST /api/accounts/login/ → access(60분) + refresh(14일) 토큰 수신
2. localStorage.setItem("accessToken", access)
3. API 요청마다 Authorization: Bearer {accessToken} 헤더 첨부
4. 401 응답 시 → POST /api/accounts/token/refresh/ 로 재발급
5. refresh 만료 시 → 로그아웃 처리 (clearAuthState())
```

### AI 커리큘럼 생성 플로우

```
POST /api/core/goals/ {goal_type, field, job_role, duration_weeks}
    ↓
Django GoalView → UserGoal 생성
    ↓
Gemini 2.0 Flash API 호출 (프롬프트: 직무/분야/기간 기반 8주 커리큘럼)
    ↓ (실패 시 → 기본 커리큘럼 폴백)
Curriculum 모델에 JSON blob으로 저장
    ↓
AiLog에 토큰/지연시간/비용 기록
    ↓
응답: { curriculum_id, weeks: [...] }
```

### 매칭 점수 계산 플로우

```
POST /api/core/matches/generate/
    ↓
사용자 LearningStats (언어·알고리즘 숙련도) 조회
    ↓
활성 JobPosting 전체 조회 (required_skills, preferred_skills)
    ↓
스킬 매칭 점수 계산 (0~100)
    ↓
Match 모델에 점수 저장
    ↓
대시보드에서 Top3 매칭 기업 노출
```

### 외부 플랫폼 ETL 플로우

```
POST /api/accounts/platform/ {platform: "baekjoon", handle: "username"}
    ↓
PlatformLink 모델에 저장
    ↓
POST /api/accounts/platform/sync/
    ↓
core/etl/baekjoon_collector.py → solved.ac API 호출
core/etl/github_collector.py → GitHub API 호출
    ↓
SolveHistory 레코드 생성/업데이트
LearningStats (언어·알고리즘별 숙련도) 집계
```

### 상태 관리 패턴 (프론트엔드)

별도 상태 관리 라이브러리 없이 React 기본 패턴 사용:

```typescript
// 로컬 컴포넌트 상태
const [data, setData] = useState<DataType[]>([])

// 전역 인증 상태 → useAuth() 훅
const { isLoggedIn, userName } = useAuth()

// 서버 데이터 페칭 → useEffect + fetch
useEffect(() => {
  const token = localStorage.getItem("accessToken")
  fetch("http://127.0.0.1:8000/api/core/dashboard/", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(res => res.json())
    .then(data => setData(data))
}, [])
```

---

## 8. 프론트엔드 개발 가이드

### shadcn/ui 사용 규칙

- `components/ui/` 는 **절대 직접 수정하지 않는다.**
- 새 컴포넌트 추가: `npx shadcn@latest add [컴포넌트명]`
- 커스터마이징 필요 시: `components/` 하위에 래핑 컴포넌트 생성

### 레이아웃 컴포넌트 선택 기준

| 상황 | 사용할 컴포넌트 |
|------|----------------|
| 비로그인 페이지 | `components/layout/public-header.tsx` |
| 로그인 후 페이지 | `components/layout/app-header.tsx` |

### 라우팅 구조

Next.js App Router 기반. 각 폴더에 `page.tsx`를 생성한다.

| 경로 | 인증 필요 여부 |
|------|---------------|
| `/` | ❌ 공개 |
| `/login`, `/register` | ❌ 공개 |
| `/goal-setting` | ✅ 최초 로그인 후 |
| `/home`, `/jobs`, `/curriculum`, `/study`, `/profile` | ✅ 로그인 필요 |
| `/board`, `/board/[id]` | ❌ 공개 (로그인 없이 열람 가능) |

### 커스텀 훅

| 훅 | 역할 |
|----|------|
| `useAuth()` | 로그인 상태 관리, 토큰 저장/삭제 |
| `useToast()` | 토스트 알림 |
| `useIsMobile()` | 반응형 브레이크포인트 감지 |

---

## 9. 백엔드 개발 가이드

### 앱별 역할 분리

| 앱 | 역할 | 모델 위치 |
|----|------|----------|
| `accounts` | 인증·사용자·플랫폼 연동 | `core.models.User`, `core.models.PlatformLink` |
| `core` | AI, 커리큘럼, 매칭, 대시보드 | `core/models.py` 및 `models_*.py` |
| `board` | 게시판 | `core.models.Post` |

### 모델 파일 분리 구조

| 파일 | 포함 모델 |
|------|----------|
| `core/models.py` | User, Company, PlatformLink, UserGoal, Curriculum, SolveHistory, LearningStats, Portfolio, JobPosting, Match, Post, AiLog (12개 기본 모델) |
| `core/models_dataset.py` | DatasetEntry, DatasetResume, DatasetJobDescription 등 (HuggingFace 데이터) |
| `core/models_new.py` | SkillGap, ProblemRecommendation, PortfolioSnapshot, PortfolioFeedback (확장 모델) |
| `core/models_problems.py` | JobProblem, LearningPathMeta, ProblemEdge 등 (6,000 문제) |

### 커스텀 관리 명령어

```bash
# 더미 데이터 생성 (기업, 공고, 게시글)
python manage.py fill_tables

# HuggingFace 이력서/JD 데이터 적재 (2,640건)
python manage.py load_dataset

# 문제 데이터 적재 (6,000건)
python manage.py load_problems --problems_dir ../DB/JobProblems --paths_dir ../DB/LearningPaths

# fill_tables + load_dataset 통합 실행
python manage.py seed_all

# 특정 사용자 플랫폼 데이터 강제 동기화
python manage.py sync_platforms --user=email@example.com
```

### 로컬 서버 실행

```bash
cd backend
python manage.py runserver
# → http://127.0.0.1:8000
# → http://127.0.0.1:8000/admin/ (관리자 페이지)
```

---

## 10. API 연동 패턴

### 기본 URL

```
로컬 개발: http://127.0.0.1:8000
```

### 공통 헤더

```typescript
const token = localStorage.getItem("accessToken")

const headers = {
  "Content-Type": "application/json",
  ...(token && { Authorization: `Bearer ${token}` }),
}
```

### 주요 API 호출 예시

#### 회원가입

```typescript
await fetch("http://127.0.0.1:8000/api/accounts/signup/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name }),
})
```

#### 로그인 + 토큰 저장

```typescript
const res = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
})
const { access, refresh } = await res.json()
localStorage.setItem("accessToken", access)
localStorage.setItem("refreshToken", refresh)
```

#### 인증 필요 API 호출

```typescript
const token = localStorage.getItem("accessToken")
const res = await fetch("http://127.0.0.1:8000/api/core/dashboard/", {
  headers: { Authorization: `Bearer ${token}` },
})
```

#### 목표 등록 (AI 커리큘럼 자동 생성)

```typescript
await fetch("http://127.0.0.1:8000/api/core/goals/", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    goal_type: "job",       // "job" | "study"
    field: "백엔드",
    job_role: "백엔드 개발자",
    duration_weeks: 12,
  }),
})
```

### 현재 → 향후 데이터 교체 패턴

```typescript
// 현재 (더미 데이터)
const companies = [{ id: 1, company: "삼성전자", ... }]

// API 연동 후
const [companies, setCompanies] = useState([])
useEffect(() => {
  fetch("http://127.0.0.1:8000/api/core/dashboard/", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(res => res.json())
    .then(data => setCompanies(data.jobs))
}, [])
```

---

## 11. 데이터베이스 구조 요약

### 총 21개 테이블

#### 기본 모델 (12개) — `core/models.py`

| 테이블 | 설명 |
|--------|------|
| `User` | 이메일 기반 사용자 (student/company/admin 역할) |
| `Company` | 기업 정보 |
| `PlatformLink` | 백준·GitHub·프로그래머스 연동 계정 |
| `UserGoal` | 학습 목표 (직무, 분야, 기간) |
| `Curriculum` | Gemini AI 생성 주차별 커리큘럼 (JSON) |
| `SolveHistory` | 문제 풀이 이력 (플랫폼, 난이도, 알고리즘 태그) |
| `LearningStats` | 언어·알고리즘별 숙련도 집계 |
| `Portfolio` | 포트폴리오 (AI 자동 생성) |
| `JobPosting` | 채용 공고 (required/preferred 스킬) |
| `Match` | 사용자↔채용공고 매칭 점수 (0~100) |
| `Post` | 게시판 글 (notice/contest/event) |
| `AiLog` | Gemini API 호출 기록 (토큰, 지연, 비용) |

#### 주요 관계

```
User ──< PlatformLink
User ──< UserGoal ──< Curriculum
User ──< SolveHistory → LearningStats
User ──< Portfolio
User ──< Match >── JobPosting
Company ──< JobPosting
```

---

## 12. 환경변수 설정

`backend/.env` 파일에 설정:

```env
# AI 연동 (필수)
GEMINI_API_KEY=AIzaSy...
GITHUB_TOKEN=ghp_...

# MySQL 전환 시 (선택, 기본은 SQLite)
# DB_NAME=elaw_db
# DB_USER=elaw_user
# DB_PASSWORD=yourpassword
# DB_HOST=localhost
# DB_PORT=3306

# 문제 데이터 경로 (load_problems 명령 시 필요)
# PROBLEMS_DIR=/path/to/DB/JobProblems
# PATHS_DIR=/path/to/DB/LearningPaths
```

> **주의**: `.env`는 절대 git에 커밋하지 않는다.

---

## 13. 개발 워크플로우

### 서버 실행 순서

```bash
# 1. 백엔드 실행
cd ELAW/backend
python manage.py runserver    # http://127.0.0.1:8000

# 2. 프론트엔드 실행 (별도 터미널)
cd ELAW/frontend
npm run dev                   # http://localhost:3000
```

### DB 초기화 (최초 1회)

```bash
cd ELAW/backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser   # 관리자 계정 생성
python manage.py fill_tables       # 더미 데이터 삽입
```

### 브랜치 전략

현재 브랜치: `feature/frontend/project3`
메인 브랜치: `main`

기능 개발: `feature/{팀}/{기능명}` 형태로 브랜치 생성 후 PR.

### 자주 발생하는 이슈

| 증상 | 해결 방법 |
|------|-----------|
| `db.sqlite3` 없음 오류 | `python manage.py migrate` 실행 |
| CORS 오류 | `settings.py`의 `CORS_ALLOW_ALL_ORIGINS = True` 확인 |
| 커리큘럼 생성 실패 | Gemini API 키 확인, 실패 시 기본 커리큘럼 자동 생성됨 |
| shadcn 컴포넌트 없음 | `npx shadcn@latest add [컴포넌트명]` 실행 |
| 401 Unauthorized | Access 토큰 만료 → `/api/accounts/token/refresh/` 호출 |

---

*이 문서는 프로젝트 구조나 규칙이 변경될 때마다 업데이트해야 합니다.*
