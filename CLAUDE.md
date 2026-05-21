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
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev        # dev server at localhost:3000
npm run build
npm start
```

### Docker (Backend)

```bash
docker-compose up  # runs backend on port 9000
```

## Architecture

```
Frontend (Next.js 16 / React 19 / TypeScript)
    ↓ REST/HTTP
Backend (Django 6 + DRF)  ←→  SQLite (dev) / MySQL (prod)
    ├── Ollama mybot          (AI portfolio generation, 30–120s)
    └── ML models             (problem recommendation)

models/ (standalone, not Django apps)
    ├── curriculum/           (GKT, SAKT, DKT knowledge-tracing ensemble)
    └── portfolio/            (Ollama wrapper for portfolio text generation)
```

### Backend Apps (`backend/`)

| App | Purpose |
|-----|---------|
| `core` | Custom `User` model, user goals, learning stats, dashboard, ETL |
| `accounts` | JWT auth (60-min access / 14-day refresh), OAuth platform linking |
| `jobs` | Job postings, scraping, AI portfolio generation, study mode |
| `board` | Community board CRUD |
| `config` | Django settings, root URL conf |

API prefix layout:
- `/api/accounts/` — auth, user profiles
- `/api/jobs/` — job listings, portfolio generation, study mode
- `/api/board/` — board CRUD
- `/api/core/` — goals, job matches, dashboard
- `/api/db/` — 13 read-only dashboard data endpoints

### Frontend Pages (`frontend/app/`)

Pages mirror the backend: auth, goal-setting (initial setup wizard), job listings & detail (with AI portfolio trigger), curriculum tracker, study mode with ML-recommended problems, community board, and user profile.

UI stack: **Tailwind CSS v4 + shadcn/ui (Radix primitives)**, forms via **React Hook Form + Zod**.

### ML Models (`models/`)

- **Curriculum**: SeedQuiz (10-question diagnostic) → zone classification → soft-voting ensemble of GKT + SAKT + DKT → next problem recommendation.
- **Portfolio**: Calls local Ollama `mybot` model via subprocess; accepts job description + user skills, returns generated portfolio text.

## Key Configuration

- **`backend/config/settings.py`**: `AUTH_USER_MODEL = 'core.User'`, `CORS_ALLOW_ALL_ORIGINS = True`, reads `.env` via python-dotenv.
- **`.env` variables**: `GITHUB_TOKEN`, `GEMINI_API_KEY` (not committed).
- **`Dockerfile`**: Python 3.13-slim, entrypoint `python manage.py runserver 0.0.0.0:9000`.

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
