# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ELAW is a job-linked learning platform (취업 연계 학습 플랫폼) — a capstone project for Mokpo National University's Convergence Software Department. It matches job postings to personalized learning paths and generates AI-powered portfolios.

## Commands

### Backend (Django)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Apply migrations and start server
python manage.py migrate
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
Frontend (Next.js 16 / React 19 / TypeScript)
    ↓ REST/HTTP (native fetch, no axios)
Backend (Django 6 + DRF)  ←→  SQLite (dev) / MySQL (prod)
    ├── Ollama mybot          (AI portfolio generation, 30–120s blocking subprocess)
    └── ML models             (problem recommendation)

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
- **Portfolio**: Calls local Ollama `mybot` model via **blocking subprocess**; accepts job description + user skills, returns generated portfolio text (30–120s). Used by `backend/jobs/portfolio_ai.py`.

Curriculum zone/weight mapping (controls ensemble behavior):

| Zone (accuracy) | GKT | SAKT | DKT |
|-----------------|-----|------|-----|
| 낮음 (<60%) | 0.40 | 0.20 | 0.40 |
| 괜찮음 (60–77%) | 0.45 | 0.20 | 0.35 |
| 높음 (≥77%) | 0.50 | 0.20 | 0.30 |

## Key Configuration

- **`backend/config/settings.py`**: `AUTH_USER_MODEL = 'core.User'` (email-based login), `CORS_ALLOW_ALL_ORIGINS = True` (dev only), reads `.env` via python-dotenv.
- **`frontend/next.config.ts`**: `typescript.ignoreBuildErrors = true` — TypeScript errors do **not** fail builds; use `npx tsc --noEmit` to catch them.
- **`.env` variables** (backend): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `GEMINI_API_KEY` (curriculum fallback), `GITHUB_TOKEN` (ETL), `DB_ENGINE`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` (MySQL, optional — defaults to SQLite).
- **`Dockerfile`**: Python 3.13-slim, entrypoint `python manage.py runserver 0.0.0.0:9000`.

## Non-Obvious Behaviors

- **Portfolio generation requires Ollama**: `jobs/portfolio_ai.py` calls a local `mybot` Ollama model via subprocess. If Ollama isn't running, portfolio endpoints will fail/hang.
- **Study mode conflict**: Creating a study goal when one is already active returns 409. Pass `?force=true` to recreate.
- **Gemini fallback**: If `GEMINI_API_KEY` is absent or the API fails, curriculum generation falls back to a hardcoded 8-week default path.
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
- AI features: implemented (Ollama portfolio, ML recommendation)
- Production DB migration (SQLite → MySQL): pending
- Backend test suites: empty stubs (no tests written yet)
