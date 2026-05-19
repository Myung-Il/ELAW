---
name: project-db-setup
description: ELAW 프로젝트 DB 셋업 상태 — 마이그레이션 위치, 모델 구조, 테이블 현황
metadata:
  type: project
---

# ELAW DB 셋업 현황 (2026-05-19 기준)

## 실제 경로 (초기 지시와 다름)

초기 지시에서는 마이그레이션이 `DB/migrations/`에 있다고 했으나 실제 운영 중인 마이그레이션 경로는 다음과 같다:
- 실제 Django 마이그레이션: `backend/core/migrations/` (0001~0006, Django가 실제로 사용하는 경로)
- `DB/migrations/` 파일들: 참고용 수동 작성 마이그레이션 (Django ORM이 추적하지 않음)

**Why:** Django는 각 앱 디렉토리 내부의 migrations/ 폴더를 사용한다. `DB/migrations/`는 참고용이고 실제 적용되는 마이그레이션은 `backend/core/migrations/`이다.

## 모델 파일 구조

모든 모델은 `backend/core/` 디렉토리에 분산:
- `backend/core/models.py` — 기본 모델 12개 (User, Company, PlatformLink, UserGoal, Curriculum, SolveHistory, LearningStats, Portfolio, JobPosting, Match, Post, AiLog)
- `backend/core/models_dataset.py` — 데이터셋 레이어 5개 (DatasetEntry, DatasetResume, DatasetJobDescription, DatasetMatchScore, DatasetLoadHistory)
- `backend/core/models_new.py` — 추천/갭/포트폴리오 레이어 4개 (SkillGap, ProblemRecommendation, PortfolioSnapshot, PortfolioFeedback)
- `backend/core/models_problems.py` — 문제 레이어 5개 (JobProblem, JobProblemCluster, ProblemEdge, LearningPathMeta, JobProblemSolveHistory)
- `backend/core/models_register.py` — 위 3개 파일에서 모두 import (models.py 맨 아래에서 `from core.models_register import *` 호출)

**How to apply:** 신규 모델 추가 시 적절한 파일(또는 models.py)에 추가하고 models_register.py에도 등록해야 Django ORM이 인식한다.

## DB 셋업 완료 사항 (2026-05-19)

1. `python manage.py migrate` 실행 완료 → `backend/db.sqlite3` 생성
2. 총 35개 테이블 생성됨 (Django 시스템 테이블 포함)
3. 비즈니스 테이블 21개: core_*, dataset_*, job_problem*, portfolio_*, problem_*, skill_gaps, learning_path_meta

## Settings.py DB 설정 (조건부)

`backend/config/settings.py`에서 `DB_HOST` 환경변수 유무로 DB 분기:
- `DB_HOST` 없음 (기본): SQLite (`backend/db.sqlite3`)
- `DB_HOST` 있음: MySQL 8.0+, utf8mb4, STRICT_TRANS_TABLES 모드

**How to apply:** MySQL 전환 시 `.env`에 `DB_HOST=localhost` (또는 컨테이너명 `db`) 설정하면 자동으로 MySQL 사용.

## docker-compose.yml 구성

- `db` 서비스: MySQL 8.0, `mysql_data` named volume, healthcheck 포함
- `backend` 서비스: `db` 서비스 healthcheck 통과 후 시작 (`depends_on: condition: service_healthy`)
- `backend`에 `environment: DB_HOST: db` 설정 → 컨테이너 환경에서는 자동으로 MySQL 사용

## .env 파일

프로젝트 루트에 `.env` 파일 생성됨 (gitignore 필요):
- `GITHUB_TOKEN`, `GEMINI_API_KEY`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `DB_HOST`, `DB_PORT`
- 현재 `DB_HOST`가 비어있어 로컬에서는 SQLite 사용
