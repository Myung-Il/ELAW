# Vercel 배포 가이드

ELAW 프론트엔드(Next.js)를 Vercel에 배포하여 메인 화면을 공개 URL로 접근 가능하게 만드는 절차.

## index.html 매칭 — Next.js 라우팅 이해

Next.js(App Router)는 별도의 `index.html` 파일 없이 **`app/page.tsx`가 곧 index.html 역할**을 한다.
Vercel이 빌드 시 각 `page.tsx`를 해당 경로의 HTML로 변환해 서빙하므로, 기존 파일 이름과 배포 URL은 아래와 같이 매칭된다.

| 기존 파일 (frontend/app/) | 배포 URL | 정적 사이트 기준 대응 파일 |
|---------------------------|----------|---------------------------|
| `page.tsx` (메인 화면) | `https://<프로젝트>.vercel.app/` | **index.html** |
| `login/page.tsx` | `/login` | login/index.html |
| `register/page.tsx` | `/register` | register/index.html |
| `home/page.tsx` | `/home` | home/index.html |
| `dashboard/page.tsx` | `/dashboard` | dashboard/index.html |
| `jobs/page.tsx` | `/jobs` | jobs/index.html |
| `jobs/[id]/page.tsx` | `/jobs/1`, `/jobs/2`, … | (동적 라우트) |
| `jobs/[id]/apply/page.tsx` | `/jobs/1/apply` | (동적 라우트) |
| `curriculum/page.tsx` | `/curriculum` | curriculum/index.html |
| `study/page.tsx` | `/study` | study/index.html |
| `board/page.tsx` | `/board` | board/index.html |
| `board/[id]/page.tsx` | `/board/1`, … | (동적 라우트) |
| `goal-setting/page.tsx` | `/goal-setting` | goal-setting/index.html |
| `profile/page.tsx` | `/profile` | profile/index.html |

> 메인 화면을 별도 index.html로 변환하면 Next.js 라우팅·미들웨어·API 프록시가 모두 끊어지므로 변환하지 않는다.

## 배포 절차

1. [vercel.com](https://vercel.com) 로그인 → **Add New → Project** → `Ohseonghwan538/ELAW` 저장소 Import
2. **Root Directory를 `frontend`로 지정** (Edit 버튼 클릭 후 선택) — 저장소 루트에는 Django 백엔드가 함께 있으므로 필수
3. Framework Preset: **Next.js** (자동 감지됨)
4. **Environment Variables** 등록:

   | Key | Value | 비고 |
   |-----|-------|------|
   | `NEXT_PUBLIC_API_URL` | 배포된 백엔드 주소 | 미등록 시 `localhost:8000` 기본값 → 배포 환경에서 API 미동작 |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 연동 시 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Supabase 연동 시 |

5. **Deploy** 클릭 → `https://<프로젝트>.vercel.app/` 으로 메인 화면 접근 확인

이후 `main` 브랜치에 push할 때마다 자동 재배포된다.

## 메인 화면 API 동작 구조

`frontend/next.config.mjs`의 rewrites가 `/api/*` 요청을 백엔드로 프록시한다:

```
브라우저 → https://<프로젝트>.vercel.app/api/jobs/
        → (rewrite) → ${NEXT_PUBLIC_API_URL}/api/jobs/
```

- 프론트 코드는 상대 경로(`fetch('/api/...')`)만 사용하므로 수정 불필요
- `NEXT_PUBLIC_API_URL`만 공개 백엔드 주소로 바꾸면 모든 API가 동작
- 백엔드(Django)는 별도 배포 필요 — Vercel은 프론트엔드만 호스팅

## Supabase 연동 (예정)

데이터베이스를 Supabase로 연동할 경우:

1. Supabase 프로젝트 생성 → Settings → API에서 URL/anon key 확인
2. `frontend/.env.example`의 Supabase 변수 주석 해제 후 `.env.local`에 값 입력
3. Vercel 환경변수에도 동일하게 등록
4. `npm install @supabase/supabase-js` 후 클라이언트 초기화 코드 추가

메인 화면의 하드코딩 데이터(`departments`, `companies`, `events`, 통계 카드 — `app/page.tsx` 상단 `[BE 매뉴얼]`/`[DB 매뉴얼]` 주석 참고)를 Supabase 테이블 조회로 교체하면 된다.
