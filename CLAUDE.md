# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ELAW is a job-linked learning platform (취업 연계 학습 플랫폼) — a capstone project for Mokpo National University's Convergence Software Department. It matches job postings to personalized learning paths and generates AI-powered portfolios.

**Deployment topology**: frontend auto-deploys to Vercel on `main` push; Django runs on the local PC (Ollama dependency) exposed via Cloudflare quick tunnel; **Supabase Postgres is the production DB**. A **fallback backend** (school datacenter container, GPU, hot standby) can take over via `scripts/switch_backend.ps1` / the `/go-fallback` skill. Full runbook: `docs/OPERATIONS.md`.

## Environment Gotchas (read first)

- **Always set `PYTHONUTF8=1`** before running Python/manage.py commands — Windows cp949 encoding breaks Korean output and `dumpdata` otherwise. PowerShell: `$env:PYTHONUTF8 = "1"`.
- The DB is **remote Supabase Postgres** (`backend/.env` → `DB_ENGINE=postgresql`, Session pooler). Commenting out `DB_ENGINE` falls back to local SQLite. Don't assume SQLite.
- **After any `migrate` against Supabase, run `python scripts/apply_supabase_rls.py`** — new tables are otherwise exposed to the public anon key via PostgREST.
- **Never use `manage.py loaddata` against Supabase** (row-by-row over WAN ≈ 90 min). Use `python scripts/fast_loaddata.py backend/backup_sqlite.json` (bulk_create, ~6 s). Dumps for it must be made **without** `--natural-foreign`.
- Ollama lives at `D:\Ollama\ollama.exe` (not on PATH). The backend calls model `mybot`; if missing: `ollama cp mybot-2b-backup:latest mybot`.
- **Vercel CLI crashes on this PC** (Korean Windows username breaks its UA header — `vercel login` is unusable). Use `scripts/update_vercel_env.ps1` (REST API + `VERCEL_TOKEN` from `backend/.env`) for env updates/redeploys.
- "Make it reachable by URL" / 시연 준비 requests → use the `/go-live` skill (`.claude/skills/go-live/`): `scripts/start_all.ps1` (Ollama+Django+tunnel as detached windows) then `scripts/update_vercel_env.ps1`.
- "풀백 서버로 실행해 줘" / fallback requests → use the `/go-fallback` skill (`.claude/skills/go-fallback/`): `scripts/switch_backend.ps1 -To fallback`. The fallback (ssh alias `elaw-nas`, supervisord stack under `/volume/elaw/`) runs hot standby with GPU inference (~10 s portfolio generation) and uses Supabase port **6543** + `DB_POOL_MODE=transaction` (school network blocks 5432). Ops: `docs/OPERATIONS.md` §10.
- `.ps1` files with Korean text must be saved as **UTF-8 with BOM** — Windows PowerShell 5.1 reads BOM-less files as cp949 and fails to parse.
- Seed account for API testing: `minjun.kim@elaw.kr` / `elaw1234!`.

## Commands

### Backend (Django)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Apply migrations and start server (remember PYTHONUTF8=1)
python manage.py migrate            # then: python ../scripts/apply_supabase_rls.py
python manage.py runserver          # port 8000 locally
# Docker runs on port 9000 per project convention

# Seed/load data
python manage.py seed_all           # initialize all data
python manage.py fill_tables        # fill DB tables
python manage.py load_dataset       # load problem datasets
python manage.py sync_platforms     # sync external platform data

# Run tests (currently empty stubs — run after writing tests)
python manage.py test
```

### Supabase ops scripts (repo root)

```bash
python scripts/supabase_reset.py          # dry-run: list tables to drop
python scripts/supabase_reset.py --yes    # drop all public tables (then migrate + reload)
python scripts/fast_loaddata.py backend/backup_sqlite.json   # bulk reload (~30k objects, ~6 s)
python scripts/apply_supabase_rls.py      # (re)apply RLS — required after every migrate
./scripts/start_tunnel.ps1                # Cloudflare quick tunnel for the local backend
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev        # dev server at localhost:3000
npm run build
npm start
npm run lint       # ESLint (Next.js default config)

# Type checking — builds succeed despite type errors due to ignoreBuildErrors: true
npx tsc --noEmit
```

### ML Models

```bash
# End-to-end curriculum pipeline integration test
# Requires DB/JobProblems/*.json and DB/LearningPaths/*.json to be present
cd models/curriculum
python test.py
```

### Docker (Backend)

```bash
docker-compose up  # runs backend on port 9000
```

## Architecture

```
[GitHub push: main] → Vercel auto-deploy (frontend/, rewrites /api/* → NEXT_PUBLIC_API_URL)
                            ↓
              Cloudflare quick tunnel (URL changes per run)
                            ↓
Frontend (Next.js 16 / React 19 / TypeScript)
    ↓ REST/HTTP (native fetch, no axios)
Backend (Django 6 + DRF, local PC)  ←→  Supabase Postgres (prod) / SQLite (local fallback)
    ├── Ollama mybot          (AI portfolio generation — async thread, 2–4 min CPU inference)
    └── ML models             (problem recommendation)
Landing page also reads Supabase directly via supabase-js (anon key, RLS read-only policies)

models/ (standalone, not Django apps — pure Python, no ORM)
    ├── curriculum/           (GKT, SAKT, DKT knowledge-tracing ensemble)
    └── portfolio/            (Ollama wrapper for portfolio text generation)
```

### Backend Apps (`backend/`)

| App | Purpose |
|-----|---------|
| `core` | Custom `User` model, user goals, learning stats, dashboard, ETL, **quiz pipeline** |
| `accounts` | JWT auth (60-min access / 14-day refresh), OAuth platform linking |
| `jobs` | Job postings, scraping, AI portfolio generation, study mode |
| `board` | Community board CRUD |
| `config` | Django settings, root URL conf |

All views inherit directly from `APIView` (not `ViewSet`). The `core` app is split across multiple view files: `views_user.py` (goals/dashboard), `views_quiz.py` (quiz pipeline), `views_db.py` (13 read-only dashboard endpoints).

API prefix layout:
- `/api/accounts/` — auth, user profiles
- `/api/jobs/` — job listings, portfolio generation, study mode
- `/api/board/` — board CRUD
- `/api/core/` — goals, job matches, dashboard, quiz pipeline
- `/api/db/` — 13 read-only dashboard data endpoints

### Frontend Pages (`frontend/app/`)

Pages mirror the backend: auth, goal-setting (initial setup wizard), job listings & detail (with AI portfolio trigger), curriculum tracker, study mode with ML-recommended problems, community board, and user profile.

UI stack: **Tailwind CSS v4 + shadcn/ui (Radix primitives)**, forms via **React Hook Form + Zod**.

**Auth middleware** (`middleware.ts`): Protects routes using a `has_token=1` cookie (mirrors the JWT stored in `localStorage`) because `localStorage` is unavailable on the Next.js edge runtime. Public paths: `/`, `/login`, `/register`.

### ML Models (`models/`)

- **Curriculum**: SeedQuiz (10-question diagnostic) → zone classification → soft-voting ensemble of GKT + SAKT + DKT → next problem recommendation. Sessions are serializable via `export_session()` / `import_session()` for resumability.
- **Portfolio**: Calls local Ollama `mybot` model (HTTP API at 127.0.0.1:11434); accepts job description + user skills, returns generated portfolio text (2–4 min CPU inference). Used by `backend/jobs/portfolio_ai.py`, invoked from a background thread (see Non-Obvious Behaviors).

Curriculum zone/weight mapping (controls ensemble behavior):

| Zone (accuracy) | GKT | SAKT | DKT |
|-----------------|-----|------|-----|
| 낮음 (<60%) | 0.40 | 0.20 | 0.40 |
| 괜찮음 (60–77%) | 0.45 | 0.20 | 0.35 |
| 높음 (≥77%) | 0.50 | 0.20 | 0.30 |

## Key Configuration

- **`backend/config/settings.py`**: `AUTH_USER_MODEL = 'core.User'` (email-based login), `CORS_ALLOW_ALL_ORIGINS = True` (dev only), reads `.env` via python-dotenv.
- **`frontend/next.config.ts`**: `typescript.ignoreBuildErrors = true` — TypeScript errors do **not** fail builds; use `npx tsc --noEmit` to catch them.
- **`.env` variables** (backend): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` (must include `.trycloudflare.com` for tunnel access), `GEMINI_API_KEY` (curriculum fallback), `GITHUB_TOKEN` (ETL), `DB_ENGINE=postgresql` + `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` (Supabase Session pooler; comment out `DB_ENGINE` → SQLite fallback; `mysql` branch also exists).
- **Vercel env vars** (set in dashboard, require Redeploy to take effect): `NEXT_PUBLIC_API_URL` (current tunnel URL), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **`Dockerfile`**: Python 3.13-slim, entrypoint `python manage.py runserver 0.0.0.0:9000`.

## Non-Obvious Behaviors

- **Portfolio generation is async** (`jobs/views.py::JobApplyView` + `_run_portfolio_generation`): `POST /api/jobs/<id>/apply/` returns **202 in <1 s** with a placeholder `Portfolio`; a background thread runs Ollama inference (2–4 min) and updates `content_json.status`: `generating → done | error`. The frontend polls `GET /api/jobs/portfolios/<id>/` every 5 s. **Do not make this synchronous** — Vercel's rewrite proxy kills responses at ~75 s and Cloudflare's edge at ~100 s (both measured).
- **Portfolio generation requires Ollama**: `jobs/portfolio_ai.py` calls the local `mybot` model via the Ollama HTTP API (127.0.0.1:11434). If Ollama isn't running, generation fails with status `error` (503 cause logged as `[Portfolio AI]`).
- **`GET /api/jobs/<id>/apply/`** returns the user's latest portfolio targeting that posting (matched via `content_json` metadata `target_posting_id`); the profile page's "지원 완료" items link to `/jobs/<id>/apply`, which auto-loads it into the editor.
- **Study mode conflict**: Creating a study goal when one is already active returns 409. Pass `?force=true` to recreate.
- **Curriculum generation is posting-based by default**: `POST /api/core/goals/` aggregates required/preferred skills from `JobPosting` rows matching the user's selected job role (Korean role names resolved via `_POSTING_ROLE_MAP` in `core/views_user.py`); `POST /api/jobs/<id>/study/` uses that posting's own skills — neither makes an AI call. Pass `"use_ai": true` to attempt Gemini instead; on failure both fall back to the skill-based path.
- **Match status is immutable**: Job match status transitions are one-way (`scrapped → applied`).
- **ML test data dependency**: `models/curriculum/test.py` requires `DB/JobProblems/*.json` and `DB/LearningPaths/*.json` to be populated first (via `python manage.py load_dataset`).

## Code Annotation Conventions (Frontend)

The frontend uses structured inline comments to mark integration points:

- `[FE 수정 매뉴얼]` — frontend-only UI changes needed
- `[BE 매뉴얼]` — where to wire up a backend API call
- `[DB 매뉴얼]` — where DB-driven data should replace hardcoded values

Many frontend pages currently use hardcoded mock data pending full API integration.

## Current Status

- Backend REST API: complete (see `backend/README.md` for full endpoint reference)
- Frontend scaffolding: complete, partial API wiring
- AI features: implemented (Ollama portfolio — async + polling, ML recommendation)
- Production DB: **migrated to Supabase Postgres** (all data loaded; RLS applied — public read on 7 landing tables only)
- Deployment: Vercel auto-deploy (frontend) + Cloudflare tunnel (backend) — see `docs/OPERATIONS.md`
- Fallback backend: school datacenter container (V100 GPU), hot standby, switch via `scripts/switch_backend.ps1` or `/go-fallback` — see `docs/planning/PRD_풀백서버_도커구축.md`
- Backend test suites: empty stubs (no tests written yet)
- Known constraints: tunnel URL changes per run (update Vercel env + Redeploy); board attachments still on local `backend/media/`
