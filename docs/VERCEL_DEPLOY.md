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

## Supabase 연동 (적용됨)

Supabase Postgres가 **운영 데이터 저장소**다. 두 경로로 접근한다:

```
Django ORM ──(psycopg, Session pooler 5432)──→ Supabase Postgres  ← 모든 읽기/쓰기
랜딩 페이지 ──(supabase-js, anon key)────────→ 〃 (RLS 공개 읽기 정책으로 제한)
```

- **Django 연결**: `backend/.env`의 `DB_ENGINE=postgresql` + `DB_*` 변수 (Session pooler 사용 — IPv4 호환). `DB_ENGINE`을 주석 처리하면 로컬 SQLite로 복귀.
- **스키마 관리**: Django 마이그레이션이 유일한 스키마 소스. 수작업 SQL(`DB/sql/1~04_*.sql`)은 참고용 문서로만 남음.
- **RLS 보안**: `DB/sql/05_rls_policies.sql` — 모든 테이블 RLS 활성 + anon 쓰기 회수, 랜딩이 읽는 7개 테이블(job_problems, learning_path_meta 등)만 anon SELECT 허용. 새 마이그레이션으로 테이블 추가 시 `python scripts/apply_supabase_rls.py` 재실행 필수.
- **초기 데이터**: `backend/backup_sqlite.json` (SQLite 전체 덤프) → `python manage.py loaddata backup_sqlite.json`. 초기화가 필요하면 `python scripts/supabase_reset.py --yes` 후 migrate → loaddata.

## 백엔드 공개 — Cloudflare Tunnel (시연용)

Django는 Ollama(AI 포트폴리오) 의존성 때문에 로컬에서 실행하고, 터널로 공개한다:

```powershell
# 터미널 1 — 백엔드
cd backend; python manage.py runserver

# 터미널 2 — 터널
.\scripts\start_tunnel.ps1     # https://xxx.trycloudflare.com URL 출력
```

1. 출력된 터널 URL을 Vercel → Settings → Environment Variables → `NEXT_PUBLIC_API_URL`에 입력
2. Deployments 탭 → 최신 배포 → **Redeploy** (환경변수는 재배포해야 반영)

> ⚠️ 무료 quick tunnel은 실행할 때마다 URL이 바뀐다 — 시연 전마다 1~2번 반복.
> ⚠️ AI 포트폴리오 생성(30~120초)은 Vercel 프록시 타임아웃에 걸릴 수 있음 — 끊기면 로컬 환경에서 시연.
