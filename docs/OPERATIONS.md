# ELAW 운영 가이드 (시연·배포·DB 관리)

> 이 문서 하나로 세션·PC 재시작 후에도 전체 시스템을 다시 띄울 수 있도록 정리한 운영 절차서.
> 작성 기준: 2026-06-05 (커밋 `3223aee`)

---

## 1. 아키텍처 한눈에 보기

```
[GitHub push: main] ──→ Vercel 자동 빌드·배포 (Root Directory=frontend)
                              │  rewrites: /api/* → NEXT_PUBLIC_API_URL
                              ▼
              Cloudflare Quick Tunnel (URL 매번 변경)
                              │
                              ▼
                  로컬 PC: Django :8000  ←──  Ollama :11434 (mybot)
                              │  psycopg (Session pooler :5432)
                              ▼
랜딩 페이지 ── supabase-js(anon key, RLS 읽기전용) ──→  Supabase Postgres (단일 데이터 저장소)
```

| 구성 요소 | 위치 | 비고 |
|-----------|------|------|
| 프론트엔드 | Vercel (`elaw-rho.vercel.app`) | main push 시 자동 재배포 |
| 백엔드 (Django) | 로컬 PC :8000 | Ollama 의존성 때문에 로컬 운영 |
| AI 모델 (Ollama) | `D:\Ollama\ollama.exe` | `mybot` 모델 필수 |
| DB | Supabase Postgres (`wqafbfduiuulsivliddy`, 서울) | 모든 데이터의 단일 저장소 |
| 터널 | Cloudflare quick tunnel | 무료, **실행할 때마다 URL 변경** |

---

## 2. 사전 준비 (PC당 1회)

이미 설정된 PC라면 건너뛰고 [3. 시연 절차](#3-시연-절차-매번)로.

### 2-1. 백엔드 의존성
```powershell
pip install -r requirements.txt        # psycopg[binary] 포함
```

### 2-2. `backend/.env` — Supabase 접속 정보
```ini
DJANGO_SECRET_KEY=<기존 값 유지>
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,.trycloudflare.com   # 터널 도메인 포함 필수

DB_ENGINE=postgresql        # 이 줄을 주석 처리하면 로컬 SQLite로 복귀
DB_NAME=postgres
DB_USER=postgres.wqafbfduiuulsivliddy
DB_PASSWORD=<Supabase DB 비밀번호>
DB_HOST=aws-1-ap-northeast-2.pooler.supabase.com   # Session pooler (IPv4 호환)
DB_PORT=5432
```
- 비밀번호를 모르면: Supabase 대시보드 → Settings → Database → **Reset database password**
- 호스트/유저는 대시보드 → **Connect → Session pooler** 탭에서 확인 (Transaction pooler 6543 아님!)

### 2-3. cloudflared 설치
```powershell
winget install --id Cloudflare.cloudflared
# 설치 직후엔 PATH 미반영일 수 있음 → 새 터미널을 열거나 전체 경로 사용:
# C:\Users\<사용자>\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_...\cloudflared.exe
```

### 2-4. Ollama 모델 확인
```powershell
D:\Ollama\ollama.exe list
# mybot:latest 가 없으면 백업본으로 복사 등록:
D:\Ollama\ollama.exe cp mybot-2b-backup:latest mybot
```

---

## 3. 시연 절차 (매번)

**터미널 3개**를 띄운다. 순서 중요: Ollama → Django → 터널.

### ① Ollama (터미널 1)
```powershell
D:\Ollama\ollama.exe serve
```
> 빠뜨리면 포트폴리오 생성이 503으로 실패한다 (가장 흔한 실수).

### ② Django (터미널 2)
```powershell
cd backend
$env:PYTHONUTF8 = "1"        # 한글 인코딩(cp949) 오류 방지
python manage.py runserver
```

### ③ Cloudflare 터널 (터미널 3)
```powershell
.\scripts\start_tunnel.ps1
# 출력에서 https://xxx-xxx-xxx.trycloudflare.com URL 복사
```

### ④ Vercel 환경변수 갱신 (터널 URL이 바뀌었을 때만)
1. [Vercel 대시보드](https://vercel.com) → ELAW 프로젝트 → **Settings → Environment Variables**
2. `NEXT_PUBLIC_API_URL` 값을 ③의 새 터널 URL로 수정 (끝에 `/` 없이)
3. **Deployments 탭 → 최신 배포 → ⋯ → Redeploy** ← 환경변수는 재배포해야 반영됨

| 환경변수 | 값 |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | `https://<터널>.trycloudflare.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wqafbfduiuulsivliddy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_b3-SNj4TP9Ej-5SlhpIjHQ_2Ebwp_W-` |

### ⑤ 동작 확인 (체크리스트)
```powershell
# 로컬 API
curl http://localhost:8000/api/jobs/          # 200 + 공고 JSON
# 터널 경유
curl https://<터널>.trycloudflare.com/api/jobs/   # 200 (400이면 ALLOWED_HOSTS 확인)
# Ollama
curl http://127.0.0.1:11434/                  # "Ollama is running"
```
- 배포 사이트 랜딩: 통계 카드가 실데이터(문제 6,000+)로 보이면 Supabase 정상
- 로그인 → 공고 → AI 포트폴리오 생성 → 2~4분 후 편집 화면 진입 확인

---

## 4. 로컬 개발 (시연 아닐 때)

```powershell
# 백엔드           # 프론트엔드
cd backend         cd frontend
python manage.py runserver     npm run dev    # localhost:3000
```
- 프론트 dev 서버는 `NEXT_PUBLIC_API_URL` 미설정 시 자동으로 `localhost:8000` 프록시 → 터널 불필요
- 타입 검사: `npx tsc --noEmit` (빌드는 타입 오류를 무시하므로 별도 실행)

---

## 5. 배포 파이프라인

```
git push origin main  →  Vercel이 자동 감지  →  빌드  →  배포 (1~2분)
```
- 프론트 코드만 빌드된다. **백엔드 변경은 로컬 Django 재시작**으로 반영.
- 배포 확인: Vercel 대시보드 Deployments 탭, 또는 사이트에서 변경점 확인.

---

## 6. Supabase DB 관리

### 6-1. 접속 구조
- **Django**: `.env`의 `DB_*` 값으로 직접 접속 (테이블 소유자 → RLS 영향 없음)
- **프론트(랜딩)**: anon key + RLS 공개 읽기 정책 7개 테이블만
  (`job_problems`, `job_problem_clusters`, `problem_edges`, `learning_path_meta`, `core_company`, `core_jobposting`, `core_post`)

### 6-2. 스키마 변경 (마이그레이션) — ⚠️ RLS 재적용 필수
```powershell
cd backend
$env:PYTHONUTF8 = "1"
python manage.py makemigrations
python manage.py migrate
cd ..
python scripts/apply_supabase_rls.py    # ← 새 테이블이 anon에 노출되는 것 방지. 반드시 실행!
```

### 6-3. DB 전체 초기화 + 재적재 (필요 시)
```powershell
$env:PYTHONUTF8 = "1"
python scripts/supabase_reset.py          # dry-run: 드롭 대상 확인
python scripts/supabase_reset.py --yes    # 실제 드롭 (전체 삭제 주의!)
cd backend
python manage.py migrate                  # Django가 전체 스키마 재생성
cd ..
python scripts/fast_loaddata.py backend/backup_sqlite.json   # 약 6초
python scripts/apply_supabase_rls.py
```
- `backend/backup_sqlite.json`: 전체 데이터 덤프 (29,850객체 — 문제 6,000·공고 1,346·사용자 29 등). git에는 없음(28MB) — 분실 시 SQLite로 복귀 후 재덤프:
  ```powershell
  cd backend
  $env:PYTHONUTF8 = "1"; $env:DB_ENGINE = "sqlite"
  python manage.py dumpdata -e contenttypes -e auth.permission -e admin.logentry -e sessions --indent 0 -o backup_sqlite.json
  # 주의: --natural-foreign 옵션 금지 (fast_loaddata와 비호환)
  ```
- ⚠️ 원격 DB에는 `manage.py loaddata`를 쓰지 말 것 — 행 단위 왕복으로 90분 이상 걸림. 반드시 `fast_loaddata.py`(bulk_create) 사용.

### 6-4. 로컬 SQLite로 복귀
`backend/.env`에서 `DB_ENGINE=postgresql` 줄만 주석 처리 → 서버 재시작.

---

## 7. AI 포트폴리오 생성 구조 (비동기)

CPU 추론이 2~4분 걸리는데 Vercel 프록시(~75초)·Cloudflare 엣지(~100초)는 그만큼 기다려주지 않으므로 **동기 방식은 불가능**하다. 현재 구조:

```
POST /api/jobs/<id>/apply/   → 0.3초 만에 202 + placeholder Portfolio 생성
  (백그라운드 스레드가 Ollama 추론 → content_json.status: generating → done | error)
GET  /api/jobs/portfolios/<id>/  ← 프론트가 5초 간격 폴링 (최대 6분)
GET  /api/jobs/<id>/apply/   → 이 공고에 작성한 내 최신 포트폴리오 (프로필 → 지원 현황 클릭)
```
- 생성 중 브라우저를 닫아도 서버에서 계속 생성됨 → 프로필 > 지원 현황에서 확인 가능
- 포트폴리오 저장 위치: Supabase `core_portfolio` (content_json에 본문+메타데이터, 재생성 시 version 증가)

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 포트폴리오 생성 실패 (503) | **Ollama 미실행** | `D:\Ollama\ollama.exe serve` (3절 ①) |
| 〃 "모델 없음" 오류 | `mybot` 모델 미등록 | `D:\Ollama\ollama.exe cp mybot-2b-backup:latest mybot` |
| 터널 경유 모든 API 400 | `ALLOWED_HOSTS`에 터널 도메인 없음 | `.env`에 `.trycloudflare.com` 포함 후 Django 재시작 |
| 배포 사이트 로그인/API 전부 실패 | 터널 URL 변경됐는데 Vercel 환경변수 구버전 | 3절 ④ (env 수정 + Redeploy) |
| `password authentication failed` | Supabase DB 비밀번호 불일치 | 대시보드에서 Reset 후 `.env` 갱신 (전파에 ~1분) |
| `value too long for type varchar` | SQLite에서 넘어온 길이 초과 데이터 | 해당 모델 `max_length` 확대 + 마이그레이션 (전례: `JobProblem.question_type` 20→50) |
| Python 한글 출력/덤프 깨짐 (`cp949`) | Windows 기본 인코딩 | 명령 전 `$env:PYTHONUTF8 = "1"` |
| 랜딩 페이지가 폴백(가짜) 데이터 표시 | Supabase RLS로 막혔거나 테이블 비어있음 | `python scripts/apply_supabase_rls.py` 재실행 / 6-3 재적재 |
| anon key로 사용자 테이블이 읽힘 | RLS 미적용 (마이그레이션 후 누락) | `python scripts/apply_supabase_rls.py` |

### 진단용 로그 위치
- Django: 실행 중인 터미널 + `backend/logs/django.log`
- 포트폴리오 생성: 로그에서 `[Portfolio AI]` 검색 — `호출 시작`/`응답 수신`/`비동기 생성 완료|실패`

---

## 9. 주요 파일·스크립트 색인

| 경로 | 용도 |
|------|------|
| `scripts/start_tunnel.ps1` | Cloudflare 터널 실행 |
| `scripts/supabase_reset.py` | Supabase 테이블 전체 드롭 (dry-run 기본) |
| `scripts/fast_loaddata.py` | 덤프 JSON 고속 적재 (bulk_create) |
| `scripts/apply_supabase_rls.py` | RLS 정책 적용 (마이그레이션 후 필수) |
| `DB/sql/05_rls_policies.sql` | RLS 정책 정의 (위 스크립트가 실행) |
| `backend/.env` | DB 접속 정보 등 — **절대 커밋 금지** |
| `backend/backup_sqlite.json` | 전체 데이터 백업 (git 미포함) |
| `docs/VERCEL_DEPLOY.md` | Vercel 초기 설정 상세 |
| `backend/jobs/portfolio_ai.py` | Ollama 호출 헬퍼 |
| `backend/jobs/views.py` → `JobApplyView`, `_run_portfolio_generation` | 비동기 생성 로직 |

### 테스트 계정 (seed 데이터)
- `minjun.kim@elaw.kr` / `elaw1234!` (seed_all 생성 계정 공통 비밀번호)

---

## 10. 향후 개선 후보 (현재 제약)

- **터널 URL 고정**: Cloudflare 계정+도메인 기반 named tunnel로 전환하면 매번 Vercel env 갱신이 불필요해짐
- **백엔드 클라우드화**: Render/Railway에 Django 배포 가능하나 Ollama 포트폴리오는 Gemini 대체 또는 비활성화 필요
- **첨부파일 클라우드화**: 게시판 첨부는 아직 로컬 `backend/media/` — Supabase Storage 전환 검토
- **테스트 코드**: 백엔드 테스트 스텁 비어있음
