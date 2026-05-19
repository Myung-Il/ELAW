# ELAW DBA 진행 현황

> 작성일: 2026-05-19  
> 기준 브랜치: `main`

---

## 목차

1. [스키마 설계 현황](#1-스키마-설계-현황)
2. [모델 파일 구조 및 Django 통합](#2-모델-파일-구조-및-django-통합)
3. [마이그레이션 이력](#3-마이그레이션-이력)
4. [인프라 및 환경 설정](#4-인프라-및-환경-설정)
5. [인덱스 및 제약 조건 전략](#5-인덱스-및-제약-조건-전략)
6. [잔여 작업 및 우선순위](#6-잔여-작업-및-우선순위)
7. [데이터 적재 계획](#7-데이터-적재-계획)

---

## 1. 스키마 설계 현황

### 1-1. 전체 구성

| 레이어 | 파일 위치 | 테이블 수 |
|--------|----------|-----------|
| 기본 (사용자·인증·학습·채용) | `backend/core/models.py` · `DB/sql/1_schema_base.sql` | 12 |
| HuggingFace 데이터셋 | `backend/core/models_dataset.py` · `DB/sql/02_schema_dataset.sql` | 5 |
| 갭분석·추천·RLHF | `backend/core/models_new.py` · `DB/sql/03_schema_new.sql` | 4 |
| 문제 데이터셋·그래프 | `backend/core/models_problems.py` · `DB/sql/04_schema_problems.sql` | 5 |
| **합계** | | **26** |

> DoList에 "21개 테이블"로 기재되어 있으나, 각 레이어 합산은 12+5+4+5 = **26**이다.  
> Django 시스템 테이블 포함 시 migrate 후 총 **35개** 테이블이 생성된다.

---

### 1-2. 레이어별 테이블 상세

#### 레이어 1 — 기본 (12개)

| Django 모델 | DB 테이블 | 설명 |
|-------------|-----------|------|
| `User` | `core_user` | 학생/기업/관리자 통합 계정. `AbstractBaseUser` 기반 커스텀 유저 |
| `Company` | `core_company` | 기업 회원 프로필 (User 1:1) |
| `PlatformLink` | `core_platformlink` | 백준·GitHub·프로그래머스 연동 |
| `UserGoal` | `core_usergoal` | 학습 목표 (study/job 분기) |
| `Curriculum` | `core_curriculum` | Gemini 생성 주차별 커리큘럼 (버전 관리) |
| `SolveHistory` | `core_solvehistory` | 외부 플랫폼 풀이 이력 (API/크롤링/수동) |
| `LearningStats` | `core_learningstats` | 언어·알고리즘 태그별 정답률 집계 (일 배치 갱신) |
| `Portfolio` | `core_portfolio` | Ollama AI 생성 포트폴리오 메인 |
| `JobPosting` | `core_jobposting` | 기업 채용 공고 |
| `Match` | `core_match` | AI 매칭 결과 및 지원 상태 추적 |
| `Post` | `core_post` | 공지/대회/이벤트 게시글 (관리자 전용 작성) |
| `AiLog` | `core_ailog` | Gemini API 호출 이력 (비용 추적·디버깅) |

#### 레이어 2 — HuggingFace 데이터셋 (5개)

> 출처: `recuse/synthetic_resume_jd_raw_dataset` (2,640행)

| Django 모델 | DB 테이블 | 설명 |
|-------------|-----------|------|
| `DatasetEntry` | `core_datasetentry` | 원본 1행 = (이력서, 채용공고) 쌍 |
| `DatasetResume` | `core_datasetresume` | 딥러닝 모델로 파싱된 구조화 이력서 |
| `DatasetJobDescription` | `core_datasetjobdescription` | 구조화 채용공고 |
| `DatasetMatchScore` | `core_datasetmatchscore` | AI 학습용 매칭 점수 (positive/negative pair) |
| `DatasetLoadHistory` | `core_datasetloadhistory` | 배치 적재 이력 |

#### 레이어 3 — 갭분석·추천·RLHF (4개)

| Django 모델 | DB 테이블 | 설명 |
|-------------|-----------|------|
| `SkillGap` | `skill_gaps` | 현재 역량 vs 공고 요구 수준 차이 (0~100 스케일) |
| `ProblemRecommendation` | `problem_recommendations` | 갭을 채우기 위한 추천 문제 1건 |
| `PortfolioSnapshot` | `portfolio_snapshots` | 포트폴리오 생성 버전 이력 (Gemini/model_v1/model_v2/수동) |
| `PortfolioFeedback` | `portfolio_feedback` | 사용자 피드백 → RLHF 학습 데이터 |

#### 레이어 4 — 문제 데이터셋·그래프 (5개)

> 출처: `DB/JobProblems/` (30직군 × 200문제 = 6,000개) + `DB/LearningPaths/`

| Django 모델 | DB 테이블 | 설명 |
|-------------|-----------|------|
| `JobProblem` | `job_problems` | 직군별 문제 원본 (객관식, 4가지 난이도) |
| `JobProblemCluster` | `job_problem_clusters` | category+subcategory로 묶인 문제 클러스터 |
| `ProblemEdge` | `problem_edges` | 문제 간 선수과목 관계 방향 그래프 |
| `LearningPathMeta` | `learning_path_meta` | 직군별 LearningPath 생성 메타 (30행) |
| `JobProblemSolveHistory` | `job_problem_solve_history` | 자체 JobProblem 풀이 이력 (`save()` 오버라이드로 통계 자동 갱신) |

---

## 2. 모델 파일 구조 및 Django 통합

### 2-1. 파일 트리

```
backend/core/
├── models.py            # 레이어 1 (12개) + 하단에 models_register.py import
├── models_dataset.py    # 레이어 2 (5개)
├── models_new.py        # 레이어 3 (4개)
├── models_problems.py   # 레이어 4 (5개)
└── models_register.py  # 위 3개 파일의 모든 모델을 __all__로 재내보내기

DB/core/                 # DBA 작업용 참조 파일 (Django 앱과 별개)
├── models_new.py        # backend/core/models_new.py 와 동일 내용
├── models_problems.py   # backend/core/models_problems.py 와 동일 내용
├── models_register.py   # 통합 등록 방법 안내 + 참조용
└── utils_ability.py     # 능력 수치화 유틸
```

### 2-2. 모델 등록 방식

`backend/core/models.py` 마지막 줄:

```python
from core.models_register import *  # noqa: F401, F403
```

`models_register.py`가 `DatasetEntry`, `SkillGap`, `JobProblem` 등 전체 14개 신규 모델을 `__all__`로 내보내며, `makemigrations`·`admin`·`shell`에서 모두 정상 인식된다.

### 2-3. 커스텀 유저 모델

```python
AUTH_USER_MODEL = 'core.User'
```

`AbstractBaseUser + PermissionsMixin` 기반. `USERNAME_FIELD = 'email'`. 모든 외래 키는 `settings.AUTH_USER_MODEL`을 참조해야 한다.

---

## 3. 마이그레이션 이력

| 파일 | 생성일 | 주요 내용 |
|------|--------|-----------|
| `0001_initial.py` | 2026-03-24 | User, Company, PlatformLink, UserGoal, Curriculum, SolveHistory, LearningStats, Portfolio, JobPosting, Match, Post, AiLog (레이어 1 전체) |
| `0002_user_is_staff_alter_user_is_superuser.py` | - | User 모델에 `is_staff` 필드 추가, `is_superuser` 수정 |
| `0003_dataset_tables.py` | - | DatasetEntry, DatasetResume, DatasetJobDescription, DatasetMatchScore, DatasetLoadHistory (레이어 2 전체) |
| `0004_merge_20260421_0714.py` | 2026-04-21 | 브랜치 병합 머지 마이그레이션 |
| `0005_alter_datasetentry_career_level_and_more.py` | - | DatasetEntry.career_level 및 기타 필드 수정 |
| `0006_portfoliosnapshot_portfoliofeedback_and_more.py` | 2026-04-26 | PortfolioSnapshot, PortfolioFeedback (레이어 3) + JobProblem, JobProblemCluster, ProblemEdge, LearningPathMeta, JobProblemSolveHistory (레이어 4) |

**현재 상태:** `migrate` 완료. `backend/db.sqlite3` 존재. Django 시스템 테이블 포함 총 **35개 테이블** 생성됨.

마이그레이션 파일 경로: `backend/core/migrations/` (Django ORM 운영 경로)

> `DB/migrations/` 에도 수동 작성 파일 3개(0003, 0005, 0006)가 있으나 Django가 추적하지 않는 참고용 파일이다. 실제 마이그레이션은 `backend/core/migrations/`만 사용한다.

---

## 4. 인프라 및 환경 설정

### 4-1. DB 설정 전략 (`backend/config/settings.py`)

```python
# .env의 DB_HOST 유무로 SQLite ↔ MySQL 자동 분기
if os.getenv("DB_HOST"):
    DATABASES = {
        "default": {
            "ENGINE":   "django.db.backends.mysql",
            "NAME":     os.getenv("DB_NAME", "elaw_db"),
            "USER":     os.getenv("DB_USER", "elaw_user"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST":     os.getenv("DB_HOST", "localhost"),
            "PORT":     os.getenv("DB_PORT", "3306"),
            "OPTIONS": {
                "charset": "utf8mb4",
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
```

| 환경 | DB_HOST 값 | 사용 DB |
|------|-----------|---------|
| 로컬 개발 | 미설정 (빈 문자열) | SQLite (`backend/db.sqlite3`) |
| Docker Compose | `db` (서비스명) | MySQL 8.0 |
| 프로덕션 서버 | 실제 호스트 주소 | MySQL 8.0 |

### 4-2. SECRET_KEY 관리

- `.env` 파일에 `SECRET_KEY` 저장
- `settings.py`에서 `os.getenv('SECRET_KEY', fallback)` 으로 로드
- 폴백 값은 개발 편의용이며, **프로덕션 배포 전 반드시 새 키로 교체** 필요

```bash
# 새 SECRET_KEY 생성 방법
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4-3. `.env` 파일 구조

```env
# Django
SECRET_KEY=django-insecure-...         # 프로덕션 전 교체 필수

# External API Keys
GITHUB_TOKEN=
GEMINI_API_KEY=

# MySQL (DB_HOST 설정 시 MySQL 활성화)
DB_NAME=elaw_db
DB_USER=elaw_user
DB_PASSWORD=elaw1234                   # 개발용 기본값
DB_ROOT_PASSWORD=root1234              # 개발용 기본값
DB_HOST=db                             # Docker: 'db', 로컬: 비워두면 SQLite
DB_PORT=3306
```

`.gitignore` 138번 줄에 `.env`가 이미 등록되어 있어 커밋 보호가 적용된다.

### 4-4. Docker Compose (`docker-compose.yml`)

```yaml
services:
  db:                                  # MySQL 8.0
    image: mysql:8.0
    volumes:
      - mysql_data:/var/lib/mysql      # 컨테이너 재시작 시 데이터 보존
    healthcheck:                       # MySQL 준비 후에만 backend 기동
      test: ["CMD", "mysqladmin", "ping", ...]
      interval: 10s / timeout: 5s / retries: 5

  backend:
    ports: ["9000:9000"]               # 교수님 요구사항: 9000 고정
    depends_on:
      db:
        condition: service_healthy     # healthcheck 통과 후 backend 시작

volumes:
  mysql_data:                          # named volume으로 데이터 영속성 보장
```

**실행 명령:**

```bash
docker compose up --build    # 최초 빌드 + 시작
docker compose up            # 재시작 (빌드 생략)
```

> `docker-compose` (하이픈) 명령은 구버전 standalone CLI이며, 최신 Docker Desktop에서는 `docker compose` (공백) 플러그인 방식을 사용한다.

---

## 5. 인덱스 및 제약 조건 전략

### 5-1. 현재 정의된 주요 인덱스

| 테이블 | 인덱스명 | 컬럼 | 목적 |
|--------|---------|------|------|
| `core_solvehistory` | `idx_solve_user_solved_at` | `user_id`, `-solved_at` | 사용자별 최근 풀이 조회 |
| `core_solvehistory` | `idx_solve_platform` | `platform` | 플랫폼 필터 |
| `core_match` | `idx_matches_user_score` | `user_id`, `-match_score` | 매칭 점수 내림차순 |
| `core_match` | `idx_matches_posting_status` | `posting_id`, `status` | 공고별 지원 현황 |
| `core_learningstats` | `idx_stats_correct_rate` | `user_id`, `correct_rate` | 취약 영역 분석 |
| `core_curriculum` | `idx_curricula_user_active` | `user_id`, `is_active` | 활성 커리큘럼 조회 |
| `core_ailog` | `idx_ai_logs_created_at` | `-created_at` | 최근 API 호출 모니터링 |
| `problem_recommendations` | `idx_pr_user_status` | `user_id`, `status` | 미도전 추천 목록 |
| `problem_recommendations` | `idx_pr_relevance` | `-relevance_score` | 관련성 높은 추천 정렬 |
| `skill_gaps` | `idx_sg_gap_score` | `-gap_score` | 갭 큰 스킬 우선 노출 |
| `portfolio_snapshots` | `idx_ps_user_final` | `user_id`, `is_final` | 최종 버전 조회 |
| `job_problems` | `idx_jp_job_role` | `job_role` | 직군별 문제 필터 |
| `problem_edges` | `idx_pe_score` | `-combined_score` | 선수과목 관계 강도 정렬 |

### 5-2. UNIQUE 제약

| 테이블 | 대상 컬럼 | 목적 |
|--------|----------|------|
| `core_user` | `email` | 이메일 중복 방지 |
| `core_platformlink` | `user_id`, `platform` | 동일 플랫폼 이중 연동 방지 |
| `core_solvehistory` | `user_id`, `platform`, `problem_id` | 동일 문제 중복 이력 방지 |
| `core_learningstats` | `user_id`, `stat_type`, `stat_key` | 언어/태그별 통계 중복 방지 |
| `core_match` | `user_id`, `posting_id` | 동일 공고 중복 매칭 방지 |
| `skill_gaps` | `user_id`, `posting_id`, `skill_name` | 동일 갭 중복 계산 방지 |
| `portfolio_feedback` | `snapshot_id`, `user_id` | 동일 스냅샷에 피드백 1회 제한 |
| `job_problems` | `job_role`, `original_question_id` | 직군 내 문제 번호 중복 방지 |

### 5-3. ON DELETE 전략

| 관계 | 전략 | 이유 |
|------|------|------|
| User 삭제 → 대부분 자식 테이블 | `CASCADE` | 사용자 탈퇴 시 모든 학습 데이터 함께 삭제 |
| Post.author 삭제 | `RESTRICT` | 관리자 계정을 보호; 게시글 있으면 삭제 불가 |
| AiLog.user 삭제 | `SET NULL` | 배치 작업 로그 보존; 사용자 탈퇴 후에도 비용 추적 유지 |
| ProblemRecommendation.posting 삭제 | `SET NULL` | 공고 삭제 후에도 추천 이력 보존 |
| JobProblemSolveHistory.from_recommendation 삭제 | `SET NULL` | 추천 삭제 후에도 풀이 이력 보존 |

---

## 6. 잔여 작업 및 우선순위

### P1 — 개발 완성 (진행 가능)

| 작업 | 방법 | 비고 |
|------|------|------|
| MySQL 전환 테스트 | `.env`에 `DB_HOST=db` 설정 후 `docker compose up --build` | `mysqlclient` 패키지 필요 |
| MySQL migrate 실행 | `docker compose exec backend python manage.py migrate` | Docker 내에서 실행 |
| `mysqlclient` 패키지 추가 | `requirements.txt`에 `mysqlclient>=2.2.0` 추가 | 현재 누락 여부 확인 필요 |

### P2 — 기능 동작 (데이터 적재)

| 작업 | 명령 | 예상 데이터 규모 |
|------|------|----------------|
| HuggingFace 데이터셋 적재 | `python manage.py load_dataset` | 2,640행 |
| 직군별 문제 데이터셋 적재 | `python manage.py load_problems --problems_dir DB/JobProblems --paths_dir DB/LearningPaths` | 6,000문제 + 클러스터 + 엣지 |
| 기초 데이터 (기업/공고/게시글) | `python manage.py fill_tables` | 개발용 시드 데이터 |

적재 순서: migrate → load_dataset → load_problems → fill_tables (FK 의존성 때문에 순서 준수 필수)

### P3 — 운영 안정성 (MySQL 전환 이후)

| 작업 | 내용 |
|------|------|
| 파티셔닝 | `core_solvehistory`: 연도별 RANGE 파티션 (`solved_at` 기준). 1년 운영 시 100만 행+ 예상 |
| 추가 인덱스 | `(user_id, platform)` on `core_solvehistory`, `(job_role, difficulty)` on `job_problems`, `(status, match_score DESC)` on `core_match` |
| Slow Query 모니터링 | Django `LOGGING`에 DB 쿼리 로그 추가, MySQL `slow_query_log` 활성화 |
| 백업 정책 | 일일 증분 백업 + 주간 전체 백업. `mysqldump` 또는 XtraBackup 검토 |
| SECRET_KEY 교체 | 프로덕션 배포 전 `.env`의 `SECRET_KEY`를 신규 생성값으로 교체 |
| `DEBUG = False` | 프로덕션에서 반드시 `False`로 설정 |
| `ALLOWED_HOSTS` 제한 | 현재 `['*']` → 실제 도메인/IP로 교체 |
| `CORS_ALLOW_ALL_ORIGINS` 제한 | 현재 `True` → 허용 origin 명시 |

---

## 7. 데이터 적재 계획

### 7-1. 전체 데이터 흐름

```
[외부 데이터 수집]
  HuggingFace (2,640행)   → dataset_entries
                           → dataset_resumes / dataset_job_descriptions (파싱)
                           → dataset_match_scores (AI 학습용 점수 계산)

  DB/JobProblems/ (30 JSON) → job_problems (6,000개)
  DB/LearningPaths/ (30 JSON) → job_problem_clusters + problem_edges + learning_path_meta

  solved.ac API            → core_solvehistory → core_learningstats (집계)
  GitHub API               → core_portfolio.content_json

[갭 분석 & 추천 파이프라인]
  core_learningstats + core_jobposting → AbilityCalculator → skill_gaps
  skill_gaps + problem_edges           → 추천 모델         → problem_recommendations

[포트폴리오 생성 & RLHF 루프]
  portfolio_snapshots (v1, Gemini)
    → 사용자 피드백 → portfolio_feedback
    → RLHFCollector.extract_training_batch()
    → 모델 재학습
    → portfolio_snapshots (v2, model_v2)
```

### 7-2. 적재 명령 순서

```bash
# 1. DB 준비 (migrate가 완료된 상태 가정)
cd backend

# 2. HuggingFace 데이터셋 적재
python manage.py load_dataset

# 3. 직군 문제 데이터셋 적재
python manage.py load_problems \
  --problems_dir ../DB/JobProblems \
  --paths_dir    ../DB/LearningPaths

# 4. 개발용 기초 데이터 (기업/공고/게시글)
python manage.py fill_tables

# 5. 플랫폼 연동 동기화 (사용자별)
python manage.py sync_platforms --user=<email>
```

### 7-3. 문제 데이터셋 구조

```
DB/JobProblems/<직군명>.json  (30개 파일)
  └─ questions[]: { question_id, difficulty, category, subcategory,
                    skills_required, scenario, question, choices,
                    correct_answer, explanation }

DB/LearningPaths/<직군명>_path.json  (30개 파일)
  └─ clusters[]:  { cluster_id, category, subcategory, question_ids, common_skills }
  └─ edges[]:     { source, target, combined_score, skill_overlap, scenario_similarity,
                    is_prerequisite }
  └─ metadata:    { total_problems, cluster_count, edge_count, difficulty_distribution, ... }
```

---

## 변경 이력

| 날짜 | 작업자 | 변경 내용 |
|------|--------|-----------|
| 2026-05-19 | DBA (오) | 스키마 4레이어 26개 테이블 설계 완료 |
| 2026-05-19 | DBA (오) | Django 마이그레이션 0001~0006 생성 및 `migrate` 완료. `backend/db.sqlite3` 생성 |
| 2026-05-19 | DBA (오) | `docker-compose.yml`: MySQL 8.0 컨테이너 + `mysql_data` named volume + healthcheck 추가 |
| 2026-05-19 | DBA (오) | `settings.py`: `DB_HOST` 환경변수 유무로 SQLite/MySQL 조건부 분기, 중복 import 제거 |
| 2026-05-19 | DBA (오) | `.env` 생성: `SECRET_KEY`, DB 자격증명 등 민감정보 외부화 |
| 2026-05-19 | DBA (오) | `settings.py`: `SECRET_KEY` 하드코딩 제거 → `.env`로 이전 |
