# Frontend PRD (Product Requirements Document)

> ELAW 플랫폼 프론트엔드 클라이언트 요구사항 정의서

---

## WHO — 이해관계자 및 담당 범위

### 주 담당팀
| 역할 | 담당 범위 |
|------|----------|
| **프론트엔드 팀** | 페이지 구현, 컴포넌트 개발, API 연동 |
| **백엔드 팀** | REST API 제공, `[BE 매뉴얼]` 주석 기반 엔드포인트 구현 |
| **DB 팀** | `[DB 매뉴얼]` 주석 기반 테이블·컬럼 확인 |

### 최종 사용자
| 유형 | 주요 사용 흐름 |
|------|--------------|
| **학습자(student)** | 회원가입 → 목표 설정 → 공고 탐색 → 학습 → 포트폴리오 생성 → 지원 |
| **비로그인 방문자** | 랜딩 페이지 → 서비스 소개 확인 → 회원가입 유도 |
| **관리자** | 공지·이벤트 게시판 관리 |

---

## WHAT — 요구사항 및 기능 명세

### 페이지별 기능 요구사항

#### 인증 (미연동)
| 페이지 | 경로 | 핵심 기능 | API 연동 상태 |
|--------|------|----------|--------------|
| 랜딩 | `/` | 서비스 소개, 학과별 데이터, CTA | 하드코딩 |
| 로그인 | `/login` | ID/PW 인증, remember me | 미연동 |
| 회원가입 | `/register` | 폼 유효성 검사, 약관 동의 | 미연동 |

#### 온보딩 (미연동)
| 페이지 | 경로 | 핵심 기능 | API 연동 상태 |
|--------|------|----------|--------------|
| 목표 설정 | `/goal-setting` | 2단계 위저드 (직군 선택 → 학습 주제) | 미연동 |

#### 핵심 기능 (미연동)
| 페이지 | 경로 | 핵심 기능 | API 연동 상태 |
|--------|------|----------|--------------|
| 대시보드 | `/home` | 추천 공고, 학습 현황, 커리큘럼 진행률 | 하드코딩 |
| 공고 목록 | `/jobs` | 검색·필터, AI 매칭 점수 표시 | 하드코딩 |
| 공고 상세 | `/jobs/[id]` | 기업 정보, 요구 스킬, 준비 현황 | 하드코딩 |
| 포트폴리오 에디터 | `/jobs/[id]/apply` | AI 초안 생성, 섹션별 편집 (경험·스킬·프로젝트) | 하드코딩 |
| 커리큘럼 | `/curriculum` | 12주 학습 계획, 진행률 트래킹, 기업 비교 | 하드코딩 |
| 학습 주제 | `/study` | 주제 목록, 커리큘럼 추가·제거 토글 | 하드코딩 |
| 게시판 목록 | `/board` | 카테고리 필터 (공지/행사/QnA), 검색, 글쓰기 | 하드코딩 |
| 게시글 상세 | `/board/[id]` | 본문, 댓글 (미구현) | 하드코딩 |
| 프로필 | `/profile` | 5탭 (개요·지원·커리큘럼·게시글·설정) | 하드코딩 |

### 컴포넌트 요구사항
- `app-header.tsx`: 인증 사용자 헤더, 데스크탑 네비게이션 + 모바일 햄버거 메뉴
- `public-header.tsx`: 비로그인 헤더, 로그인·회원가입 버튼
- `components/ui/`: shadcn/ui 기본 컴포넌트 — **직접 수정 금지**

### 미구현 항목 (기술 부채)
- [ ] 인증 미들웨어 (`middleware.ts`) — 보호된 라우트 리다이렉트
- [ ] `useAuth()` 전역 훅 — 토큰·사용자 상태 관리
- [ ] 토큰 자동 갱신 인터셉터 (401 응답 처리)
- [ ] React Hook Form + Zod 통합 (현재 useState 직접 관리)
- [ ] 로딩 스켈레톤 UI
- [ ] 에러 바운더리 컴포넌트
- [ ] 게시글 상세 댓글 기능

---

## WHEN — 일정 및 현재 상태

### 현재 상태
| 항목 | 상태 |
|------|------|
| 전체 페이지 스캐폴딩 (14개) | 완료 |
| 컴포넌트 라이브러리 구축 (shadcn/ui) | 완료 |
| UI 레이아웃 및 반응형 | 완료 |
| 하드코딩 목 데이터 | 완료 |
| 백엔드 API 연동 | **미완료** |
| 인증 플로우 구현 | **미완료** |
| 라우트 보호 미들웨어 | **미완료** |

### API 연동 우선순위
| 우선순위 | 기능 | 연동 엔드포인트 |
|----------|------|----------------|
| P0 | 로그인·회원가입 | `POST /api/accounts/login/`, `/signup/` |
| P0 | 토큰 갱신 인터셉터 | `POST /api/accounts/token/refresh/` |
| P0 | 라우트 보호 미들웨어 | — |
| P1 | 채용공고 목록·상세 | `GET /api/jobs/`, `/api/jobs/<id>/` |
| P1 | 스크랩 버튼 | `POST/DELETE /api/jobs/<id>/scrap/` |
| P1 | AI 포트폴리오 생성 + 로딩 처리 | `POST /api/jobs/<id>/apply/` |
| P2 | 대시보드 | `GET /api/core/dashboard/` |
| P2 | 커리큘럼·목표 | `GET/POST /api/core/goals/` |
| P2 | 게시판 CRUD | `GET/POST /api/board/` |

---

## WHERE — 범위 및 시스템 경계

### 파일 구조
```
frontend/
├── app/                  # Next.js App Router 페이지
│   ├── (auth)/           # login, register
│   ├── goal-setting/
│   ├── home/
│   ├── jobs/[id]/apply/
│   ├── curriculum/
│   ├── study/
│   ├── board/[id]/
│   └── profile/
├── components/
│   ├── layout/           # app-header, public-header
│   └── ui/               # shadcn/ui (수정 금지)
└── hooks/                # use-mobile, use-toast
```

### 연동 경계
| 방향 | 대상 | 방식 |
|------|------|------|
| Frontend → Backend | `http://localhost:8000` | fetch() + JWT Bearer 헤더 |
| 인증 토큰 저장 | localStorage | `access_token`, `refresh_token` |
| 반응형 브레이크포인트 | Tailwind CSS | sm(640) / md(768) / lg(1024) |

---

## WHY — 목적 및 비즈니스 가치

### 해결하는 문제
1. **학습 동기 부족**: 취업 목표와 연결된 커리큘럼 시각화로 학습 지속성 향상
2. **포트폴리오 작성 장벽**: AI 초안 제공으로 신입 개발자의 지원 시작점 낮춤
3. **공고-역량 불일치**: AI 매칭 점수 시각화로 현재 실력과 목표 공고 간 갭 직관적 파악

### UX 설계 원칙
- **온보딩 위저드**: 최초 로그인 시 직군·주제 선택 → 즉시 맞춤 커리큘럼 진입
- **점진적 공개**: 학습 진행에 따라 locked → in-progress → completed 상태 전환
- **팀 협업 주석**: `[FE 수정 매뉴얼]` / `[BE 매뉴얼]` / `[DB 매뉴얼]`로 역할 명확화

### 기술 선택 이유
| 선택 | 이유 |
|------|------|
| Next.js App Router | SSR/SSG 혼용 가능, 라우트 기반 코드 스플리팅 |
| shadcn/ui | 소유권 기반 컴포넌트, Radix 접근성 기본 제공, 커스터마이징 자유 |
| Tailwind CSS v4 | oklch 색상 시스템, 유틸리티 클래스 일관성 |
| localStorage 토큰 | 구현 단순성 (추후 httpOnly 쿠키 전환 고려) |

---

## HOW — 구현 방법 및 기술 제약

### 하드코딩 → API 연동 전환 패턴

```typescript
// Before (현재 — 모든 페이지 상단에 정적 배열)
const jobs = [{ id: 1, title: "백엔드 개발자", company: "카카오", ... }]

// After (API 연동)
const [jobs, setJobs] = useState([])
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
  setIsLoading(true)
  const token = localStorage.getItem('access_token')
  fetch('/api/jobs/', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => setJobs(data))
    .finally(() => setIsLoading(false))
}, [])
```

### 인증 흐름 구현 가이드

```typescript
// 1. 로그인 → 토큰 저장
const { access, refresh } = await res.json()
localStorage.setItem('access_token', access)
localStorage.setItem('refresh_token', refresh)

// 2. is_first_login 분기
router.push(is_first_login ? '/goal-setting' : '/home')

// 3. 401 자동 갱신 인터셉터 (구현 필요)
if (res.status === 401) {
  const { access } = await refreshToken()
  localStorage.setItem('access_token', access)
  return fetch(url, { ...options, headers: { Authorization: `Bearer ${access}` } })
}
```

### AI 포트폴리오 생성 UX 요구사항
- `POST /api/jobs/<id>/apply/` 응답 시간: **30~120초**
- 요청 시작 즉시 전체 화면 로딩 오버레이 표시
- 타임아웃(120초) 초과 시 사용자 안내 메시지 + 재시도 버튼
- 생성 완료 후 포트폴리오 에디터 화면으로 전환

### 스터디 모드 409 처리

```typescript
const res = await fetch(`/api/jobs/${id}/study/`, { method: 'POST', headers })
if (res.status === 409) {
  // "이미 학습 중인 공고가 있습니다. 재시작할까요?" 확인 다이얼로그
  const confirmed = confirm("...")
  if (confirmed) {
    await fetch(`/api/jobs/${id}/study/?force=true`, { method: 'POST', headers })
  }
}
```

### 3계층 주석 시스템 — 협업 규약

미구현 구간에 반드시 아래 형식으로 주석을 유지한다:

```typescript
// [FE 수정 매뉴얼] 아래 하드코딩 배열을 useEffect + fetch로 교체
// [BE 매뉴얼] GET /api/jobs/ → { id, title, company, match_score }[]
// [DB 매뉴얼] job_postings: id, title, company_id, required_skills(JSON)
```

### TypeScript 주의
- `next.config.mjs`에 `typescript.ignoreBuildErrors: true` 설정 중
- 타입 오류는 `npx tsc --noEmit`으로 별도 확인
- 빌드 성공이 타입 안전성을 보장하지 않음
