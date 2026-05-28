# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행

```bash
npm install
npm run dev    # localhost:3000
npm run build
npm start
```

## 기술 스택

- **프레임워크**: Next.js 16.2 (App Router) + React 19 + TypeScript 5.7
- **스타일**: Tailwind CSS v4 + shadcn/ui (Radix UI 기반)
- **폼**: React Hook Form + Zod (설치됨, 일부 페이지에서 미사용)
- **차트**: Recharts / **아이콘**: Lucide React
- **상태관리**: React 기본 훅 (useState/useContext) — Redux/Zustand 없음
- **API 호출**: Native `fetch()` — axios 없음

## 페이지 라우트

| 경로 | 인증 | 설명 |
|------|------|------|
| `/` | ❌ | 랜딩 페이지 |
| `/login` | ❌ | 로그인 |
| `/register` | ❌ | 회원가입 |
| `/goal-setting` | ✅ | 최초 로그인 온보딩 (2단계 위저드) |
| `/home` | ✅ | 메인 대시보드 |
| `/jobs` | ✅ | 채용공고 목록 (검색·필터·AI 매칭 점수) |
| `/jobs/[id]` | ✅ | 공고 상세 |
| `/jobs/[id]/apply` | ✅ | AI 포트폴리오 에디터 |
| `/curriculum` | ✅ | 12주 학습 커리큘럼 |
| `/study` | ✅ | 학습 주제 목록 |
| `/board` | ✅ | 커뮤니티 게시판 |
| `/board/[id]` | ✅ | 게시글 상세 |
| `/profile` | ✅ | 프로필 (탭: 개요/지원/커리큘럼/게시글/설정) |

## 컴포넌트 구조

```
components/
├── layout/
│   ├── app-header.tsx    # 인증 사용자 헤더 (네비게이션, 프로필 드롭다운)
│   └── public-header.tsx # 랜딩 페이지 헤더
└── ui/                   # shadcn/ui 컴포넌트 — 직접 수정 금지
```

`app-header.tsx` 는 `userName`, `userDept`, `notificationCount` props를 받지만 현재 하드코딩됨 (BE 연동 필요).

## 3계층 주석 시스템 — 핵심 협업 규약

코드 전반에 걸쳐 팀 간 역할을 명시하는 주석이 사용된다. 새 코드 작성 시 동일한 형식을 따른다.

```typescript
// [FE 수정 매뉴얼] 아래 배열을 useEffect + fetch로 교체 필요
// [BE 매뉴얼] GET /api/jobs/ → { id, title, company, match_score }[]
// [DB 매뉴얼] job_postings 테이블: id, title, company_id, required_skills
```

- `[FE 수정 매뉴얼]`: 프론트엔드 팀이 처리해야 할 구현 항목
- `[BE 매뉴얼]`: 백엔드 팀이 구현해야 할 엔드포인트 명세
- `[DB 매뉴얼]`: DB 팀이 참조할 테이블/컬럼 정보

미구현 항목 전체 검색:
```bash
grep -r "\[FE 수정\]\|\[BE 매뉴얼\]\|\[DB 매뉴얼\]\|TODO:" app/
```

## 하드코딩 데이터 패턴

현재 모든 페이지의 데이터는 컴포넌트 파일 상단에 정적 배열로 선언되어 있다.

```typescript
// 교체 전 (현재)
const jobs = [{ id: 1, title: "백엔드 개발자", company: "카카오", ... }]

// 교체 후 (API 연동)
const [jobs, setJobs] = useState([])
useEffect(() => {
  const token = localStorage.getItem('access_token')
  fetch('/api/jobs/', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(data => setJobs(data))
}, [])
```

## 인증 흐름 (미구현 → 구현 가이드)

```
POST /api/accounts/login/ → { access, refresh, is_first_login }
  ↓
localStorage.setItem('access_token', access)
  ↓
is_first_login? → /goal-setting : /home
  ↓
401 응답 시 → POST /api/accounts/token/refresh/ → 토큰 갱신
```

현재 미구현 항목:
- 라우트 보호 미들웨어 (`middleware.ts`)
- `useAuth()` 전역 훅
- 토큰 만료 자동 갱신

## 폼 상태 관리

현재 React Hook Form 없이 직접 `useState`로 관리:
```typescript
const [form, setForm] = useState({ email: "", password: "" })
const handleChange = (field) => (e) =>
  setForm(prev => ({ ...prev, [field]: e.target.value }))
```

Zod + React Hook Form 통합은 `[FE 수정 매뉴얼]` 주석이 달린 폼부터 우선 적용한다.

## 스타일링 컨벤션

- 색상 변수: `globals.css`의 oklch 기반 CSS 변수 사용 (`--primary`, `--accent`, `--muted` 등)
- 다크모드: `:root.dark { ... }` 정의됨, 토글 UI 미구현
- 반응형: 모바일 퍼스트, `hidden md:flex` 패턴으로 브레이크포인트 분기
- 카드 호버: `card-hover` 유틸리티 클래스 사용 (globals.css에 정의)

## TypeScript 설정 주의

`next.config.mjs`에 `typescript: { ignoreBuildErrors: true }` 설정됨 — 빌드 시 타입 오류가 무시된다. 타입 오류는 `npx tsc --noEmit`으로 별도 확인한다.
