# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ELAW is an AI-driven learning support and job placement platform for Mokpo National University's Convergence Software Department. It matches students with jobs, generates AI-powered curricula and portfolios, and tracks coding problem-solving progress across external platforms (Baekjoon, GitHub, Programmers).

## Commands

### Frontend (Next.js)

```bash
cd frontend
npm run dev       # Start dev server (default port 3000)
npm run build     # Production build
npm run lint      # ESLint check
```

### Backend (Django)

```bash
cd backend
python manage.py runserver 9000          # Start dev server (port 9000 — not 8000)
python manage.py migrate                 # Apply migrations
python manage.py makemigrations          # Create migrations after model changes
python manage.py createsuperuser         # Create admin user
```

### Docker

```bash
docker-compose up --build    # Build and start backend container
docker-compose up            # Start without rebuilding
```

## Architecture

### Monorepo Layout

```
frontend/    # Next.js 16 + React 19 + TypeScript (App Router)
backend/     # Django 6.0 + Django REST Framework (port 9000)
DB/          # Problem datasets (30 roles × 200 problems), migrations, SQL schemas
docs/        # PRD, environment setup guide, git conventions
```

### Frontend

- **Framework:** Next.js 16 App Router. Pages live under `frontend/app/`.
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix UI). Component library config in `frontend/components.json`.
- **Forms:** React Hook Form + Zod for validation.
- **Path alias:** `@/*` resolves to `frontend/*`.
- **State:** No global state library — data is fetched per-page. Most pages still use hardcoded data pending backend API completion.

Key pages: `home/` (dashboard), `jobs/` (listings + apply flow), `curriculum/`, `study/`, `board/` (community), `goal-setting/` (onboarding).

### Backend

- **Apps:** `accounts` (auth, profiles, platform links), `core` (goals, curricula, portfolios, matching, AI logs), `jobs` (postings, applications), `board` (admin-only posts).
- **Custom User model:** `core.User` — all auth references use this, not `auth.User`.
- **All models** are defined in `core/models.py`. The other apps' `models.py` files are intentionally empty and import from `core`.
- **JWT:** Access token 60 min, refresh token 14 days. Frontend must handle token refresh.
- **AI integrations:** Gemini API for curriculum generation (`core/`), Ollama (`mybot` model) for portfolio generation (`jobs/portfolio_ai.py`).

### API

Base URL: `http://localhost:9000/api/`

| Prefix | App |
|--------|-----|
| `/api/accounts/` | auth, profile, platform links |
| `/api/jobs/` | job listings, scraps, apply, portfolios |
| `/api/board/` | community posts |
| `/api/core/` | goals, matching, dashboard |
| `/api/db/` | dataset query views for dashboards |

### Database

- **Dev:** SQLite (`db.sqlite3` at repo root)
- **Prod:** MySQL 8.0+ (env vars: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`)
- Migration files live in `DB/migrations/`, not in the individual app directories.

## Environment Variables

Create `.env` in repo root (loaded by Django via `python-dotenv`):

```
GITHUB_TOKEN=
GEMINI_API_KEY=
# MySQL (production only)
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
```

## Git Conventions

### Branch naming: `type/role/task-name`

- Types: `feature`, `fix`, `hotfix`, `refactor`
- Roles: `backend`, `frontend`, `database`, `test`, `etc`
- Example: `feature/backend/login-api`, `fix/frontend/header-layout`
- After merging a `feature` branch, create a new `fix` branch for follow-up changes — do not reuse the old branch.

### Commit format: `type: 변경 내용`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `design`, `comment`, `rename`, `remove`, `!BREAKING CHANGE`, `!HOTFIX`

Examples: `feat: 로그인 기능 추가`, `fix: 로그인 오류 수정`

## Key Development Notes

- The backend runs on **port 9000** (professor's requirement — do not change to 8000).
- Frontend pages that call backend APIs use `[FE 수정 매뉴얼]` comments to mark where integration is needed; backend views use `[BE 매뉴얼]` and `TODO:` markers.
- Two main user flows: **Study mode** (creates a `UserGoal`) and **Apply mode** (generates a `Portfolio` via Ollama AI).
- CORS is fully open (`ALLOWED_HOSTS = ['*']`) in development — tighten before production.
- `api_test.http` in the repo root contains sample REST Client requests for manual API testing.
