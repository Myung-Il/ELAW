# ELAW 프론트엔드 (frontend/)

## 팀 역할
이 폴더는 **프론트엔드 팀** 전용입니다.

## 기술 스택
- Next.js 16.2 (App Router)
- React 19 + TypeScript 5.7
- Tailwind CSS v4 + shadcn/ui (Radix UI)
- React Hook Form + Zod (폼 검증)

## 시작하기

```bash
# 1. 이 폴더로 이동
cd frontend

# 2. shadcn/ui 컴포넌트 복사 (최초 1회)
# 루트 project/components/ui 폴더를 frontend/components/ui 로 복사
cp -r ../components/ui ./components/ui
cp -r ../components/theme-provider.tsx ./components/
cp -r ../hooks/use-toast.ts ./hooks/
cp -r ../styles/ ./styles/    # (있는 경우)

# 3. 의존성 설치
npm install

# 4. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

## 페이지 구조

```
app/
├── page.tsx                  ← 랜딩 페이지 (비로그인)
├── login/page.tsx            ← 로그인
├── register/page.tsx         ← 회원가입
├── goal-setting/page.tsx     ← 목표 설정 (최초 로그인)
├── home/page.tsx             ← 메인 페이지 (로그인 후)
├── jobs/
│   ├── page.tsx              ← 기업 공고 목록
│   └── [id]/
│       ├── page.tsx          ← 기업 공고 상세
│       └── apply/page.tsx    ← 포트폴리오 작성 & 지원
├── curriculum/page.tsx       ← 커리큘럼 현황
├── study/page.tsx            ← 공부 목록
├── board/
│   ├── page.tsx              ← 게시판 목록
│   └── [id]/page.tsx         ← 게시글 상세
└── profile/page.tsx          ← 프로필
```

## 컴포넌트 구조

```
components/
├── ui/                       ← shadcn/ui 기본 컴포넌트 (수정 금지)
└── layout/
    ├── public-header.tsx     ← 비로그인 헤더 (로그인/회원가입 버튼)
    └── app-header.tsx        ← 로그인 후 헤더 (프로필 드롭다운)
```

## API 연동 가이드

현재 모든 데이터는 하드코딩 상태입니다.
BE 팀이 API를 완성하면 아래 패턴으로 교체하세요:

```typescript
// 현재 (하드코딩)
const companies = [
  { id: 1, company: "삼성전자", ... },
]

// 변경 후 (API 연동)
const [companies, setCompanies] = useState([])
useEffect(() => {
  fetch("/api/v1/jobs/recommended", {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  .then(res => res.json())
  .then(data => setCompanies(data.jobs))
}, [])
```

## 주요 코드 주석 규칙

코드 내 주석을 찾아보면 어디를 수정해야 하는지 알 수 있습니다:
- `[FE 수정 매뉴얼]` - 이 FE 팀이 수정/구현해야 할 부분
- `[BE 매뉴얼]` - BE 팀에게 필요한 API 명세
- `[DB 매뉴얼]` - DB 팀에게 필요한 테이블/컬럼 정보
- `TODO:` - 임시 코드, 실제 구현으로 교체 필요