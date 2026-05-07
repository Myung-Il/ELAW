# ELAW 데이터베이스 README

> **대상 독자**: DB 담당자, 백엔드 개발자, 새로 합류한 팀원
> 이 문서는 ELAW 프로젝트의 DB 구조와 데이터 흐름을 누구나 쉽게 이해할 수 있도록 작성되었습니다.

---

## 목차

1. [데이터베이스 구성 요약](#1-데이터베이스-구성-요약)
2. [전체 테이블 목록 (21개)](#2-전체-테이블-목록-21개)
3. [폴더 및 파일 구조](#3-폴더-및-파일-구조)
4. [데이터 흐름 다이어그램](#4-데이터-흐름-다이어그램)
5. [로컬 DB 실행 방법](#5-로컬-db-실행-방법)
6. [데이터 적재 방법 (Seeding)](#6-데이터-적재-방법-seeding)
7. [MySQL 전환 방법](#7-mysql-전환-방법)
8. [테이블 상세 설명](#8-테이블-상세-설명)

---

## 1. 데이터베이스 구성 요약

| 항목 | 내용 |
|------|------|
| **로컬 개발 DB** | **SQLite3** (설치 불필요, `backend/db.sqlite3` 파일로 자동 생성) |
| **운영 목표 DB** | **MySQL 8.0** (utf8mb4, 멀티바이트 한글 완벽 지원) |
| **ORM** | Django ORM (Python 코드로 DB 조작, SQL 직접 작성 불필요) |
| **마이그레이션** | `python manage.py migrate` 로 테이블 자동 생성/업데이트 |
| **총 테이블 수** | **21개** (기본 12개 + 데이터셋 5개 + 문제 5개 + 확장 4개) |

### DB가 사용되는 레이어

```
[사용자]               [AI/분석]                  [데이터셋]
 ─ core_user          ─ core_curriculum            ─ dataset_entries
 ─ core_company       ─ core_ailog                 ─ dataset_resumes
 ─ core_platformlink  ─ skill_gaps                 ─ dataset_job_descriptions
 ─ core_usergoal      ─ problem_recommendations    ─ dataset_match_scores
                                                   ─ dataset_load_history

[문제/학습경로]         [채용]                     [포트폴리오]
 ─ job_problems        ─ core_jobposting            ─ core_portfolio
 ─ job_problem_clusters─ core_match                 ─ portfolio_snapshots
 ─ problem_edges       ─ core_post                  ─ portfolio_feedback
 ─ learning_path_meta
 ─ job_problem_solve_history
                       ─ core_learningstats
                       ─ core_solvehistory
```

---

## 2. 전체 테이블 목록 (21개)

### 레이어 1 — 기본 12개 테이블 (`1_schema_base.sql` / Django migrations)

| 테이블 | 한글 명칭 | 핵심 역할 |
|--------|-----------|-----------|
| `core_user` | 사용자 | 학생·기업·관리자 통합 계정 (email 기반 로그인) |
| `core_company` | 기업 | core_user(role=company)와 1:1 연결, 기업 상세 정보 |
| `core_platformlink` | 플랫폼 연동 | 백준·GitHub·프로그래머스 아이디 저장 |
| `core_usergoal` | 학습 목표 | 목표 직무·분야·기간·시작일 저장 |
| `core_curriculum` | 커리큘럼 | Gemini가 생성한 주차별 학습 계획 (JSON 형태) |
| `core_solvehistory` | 풀이 이력 | 백준·프로그래머스에서 수집한 문제 풀이 원본 데이터 |
| `core_learningstats` | 학습 통계 | 언어별·알고리즘 태그별 정답률 집계 (일 배치 갱신) |
| `core_portfolio` | 포트폴리오 | AI 자동 생성 포트폴리오 (공개 URL slug 포함) |
| `core_jobposting` | 채용공고 | 기업이 등록한 채용 공고 (필수/우대 스킬 JSON 포함) |
| `core_match` | 매칭 결과 | 사용자-공고 AI 매칭 점수(0~100) 및 지원 상태 |
| `core_post` | 게시글 | 공지·대회·이벤트 (관리자만 작성) |
| `core_ailog` | AI 호출 기록 | Gemini API 호출 이력 (비용 추적·디버깅용) |

### 레이어 2 — 데이터셋 5개 (`03_schema_dataset.sql`)

| 테이블 | 설명 |
|--------|------|
| `dataset_entries` | HuggingFace `recuse/synthetic_resume_jd` 원본 2,640행 |
| `dataset_resumes` | 원본에서 이력서 부분만 파싱하여 구조화한 데이터 |
| `dataset_job_descriptions` | 원본에서 채용공고 부분만 파싱하여 구조화한 데이터 |
| `dataset_match_scores` | AI 학습용 매칭 점수 레이블 (positive/negative pair) |
| `dataset_load_history` | 배치 적재 이력 (언제 몇 건이 적재됐는지 기록) |

### 레이어 3 — 문제 5개 (`04_schema_problems.sql`)

| 테이블 | 설명 |
|--------|------|
| `job_problems` | 30직군 × 200문제 = **6,000개** 코딩 문제 (JSON 파일 `DB/JobProblems/`에서 적재) |
| `job_problem_clusters` | 문제 묶음 단위 (category + subcategory 기준 클러스터) |
| `problem_edges` | 문제 간 선수 관계 그래프 (A문제를 풀어야 B문제로 진행 가능) |
| `learning_path_meta` | 30개 직군별 학습 경로 메타 (JSON 파일 `DB/LearningPaths/`에서 적재) |
| `job_problem_solve_history` | ELAW 자체 문제 풀이 이력 (core_solvehistory와 별도 관리) |

### 레이어 4 — 스킬 갭 & 추천 2개 (`03_schema_new.sql`)

| 테이블 | 설명 |
|--------|------|
| `skill_gaps` | 사용자 현재 수준 vs 채용공고 요구 수준의 차이(gap_score) 계산 결과 |
| `problem_recommendations` | 갭을 채우기 위해 추천된 문제 목록 (추천 이유·관련성 점수 포함) |

### 레이어 5 — 포트폴리오 & RLHF 2개 (`03_schema_new.sql`)

| 테이블 | 설명 |
|--------|------|
| `portfolio_snapshots` | 포트폴리오 버전 이력 (수정할 때마다 스냅샷 저장) |
| `portfolio_feedback` | 사용자가 포트폴리오에 준 피드백 (AI 모델 재학습 데이터로 활용) |

---

## 3. 폴더 및 파일 구조

```
DB/
│
├── setup.sh                     # ★ DB 전체 초기화 자동화 스크립트
│                                # 실행: chmod +x DB/setup.sh && ./DB/setup.sh
│                                # MySQL 생성 → 마이그레이션 → 데이터 적재를 한 번에 처리
│
├── docs/                        # 문서 폴더
│   ├── README.md                # DB 담당자가 작성한 간략한 운영 가이드
│   ├── DB_DOCUMENT.html         # DB 설계 문서 (브라우저로 열면 ER 다이어그램 확인 가능)
│   └── ELAW 프로젝트 DB 설계 문서.pdf  # 오프라인 참고용 PDF
│
├── sql/                         # ★ MySQL용 스키마 정의 SQL 파일들
│   │                            # (SQLite는 Django migration으로 자동 생성되므로
│   │                            #  이 SQL 파일은 MySQL 전환 시 또는 참조용으로 사용)
│   │
│   ├── 1_schema_base.sql        # 기본 12개 테이블 생성 쿼리
│   │                            # Users, Companies, Curricula 등 핵심 테이블
│   │                            # 적용: mysql -u elaw_user -p elaw_db < 1_schema_base.sql
│   │
│   ├── 02_schema_dataset.sql    # HuggingFace 데이터셋용 테이블 5개
│   │                            # DatasetEntry, DatasetResume 등
│   │
│   ├── 03_schema_new.sql        # 확장 테이블 4개 (스킬갭·추천·포트폴리오 스냅샷)
│   │                            # SkillGap, ProblemRecommendation,
│   │                            # PortfolioSnapshot, PortfolioFeedback
│   │
│   └── 04_schema_problems.sql   # 문제·학습경로 테이블 5개
│                                # JobProblem, LearningPathMeta, ProblemEdge 등
│
├── JobProblems/                 # ★ 직군별 코딩 문제 JSON 파일 (30개 직군 × 200문제)
│   │                            # python manage.py load_problems 명령어로 DB에 적재
│   │
│   ├── Software_Engineer.json   # 소프트웨어 엔지니어 문제 200개
│   ├── Backend_Engineer.json    # 백엔드 엔지니어 문제 200개
│   ├── Frontend_Developer.json  # 프론트엔드 개발자 문제 200개
│   ├── AI_Engineer.json         # AI 엔지니어 문제 200개
│   ├── Data_Engineer.json       # 데이터 엔지니어 문제 200개
│   ├── DevOps_Engineer.json     # DevOps 엔지니어 문제 200개
│   ├── Mobile_App_Developer.json        # 모바일 앱 개발자
│   ├── Machine_Learning_Researcher.json # ML 연구자
│   ├── Security_Engineer.json           # 보안 엔지니어
│   ├── Embedded_Systems_Engineer.json   # 임베디드 시스템 엔지니어
│   └── ... (총 30개 파일)               # 나머지 직군들
│
├── LearningPaths/               # ★ 직군별 학습 경로 JSON 파일 (30개 직군)
│   │                            # 각 파일에는 해당 직군의 학습 단계·순서·추천 주제가 담김
│   │                            # python manage.py load_problems --paths_dir ... 로 적재
│   │
│   ├── Backend_Engineer_path.json       # 백엔드 개발자 학습 경로
│   ├── Frontend_Developer_path.json     # 프론트엔드 개발자 학습 경로
│   ├── AI_Engineer_path.json            # AI 엔지니어 학습 경로
│   └── ... (총 30개 파일)
│
├── migrations/                  # DB 스키마 변경 이력 (Django migration 파일 사본)
│   ├── 0003_dataset_tables.py   # 데이터셋 테이블 5개 추가 마이그레이션
│   ├── 0005_new_tables.py       # 스킬갭·추천 테이블 추가 마이그레이션
│   └── 0006_problem_tables.py   # 문제·학습경로 테이블 추가 마이그레이션
│
└── core/                        # Django models와 동기화된 코드 사본 (참고용)
    ├── models_new.py            # SkillGap, ProblemRecommendation, PortfolioSnapshot 모델
    ├── models_problems.py       # JobProblem, LearningPathMeta 모델
    ├── models_register.py       # 신규 모델을 core/models.py에 등록하는 import 구문
    ├── utils_ability.py         # 역량 계산 유틸리티 (AbilityCalculator)
    └── management/commands/
        └── load_problems.py     # 문제 JSON → DB 적재 커맨드
```

---

## 4. 데이터 흐름 다이어그램

```
══════════════════════════════════════════════════════════════
  데이터 수집 단계
══════════════════════════════════════════════════════════════

① 외부 플랫폼 데이터 수집 (ETL)
   solved.ac API ──→ core_solvehistory ──→ core_learningstats
   GitHub   API ──→ core_portfolio.content_json

② HuggingFace 이력서/JD 데이터셋 적재
   load_dataset ──→ dataset_entries
                ──→ dataset_resumes
                ──→ dataset_job_descriptions
                ──→ dataset_match_scores (AI 학습용 레이블)

③ 직군별 문제 데이터셋 적재
   load_problems ──→ job_problems (6,000개)
                 ──→ job_problem_clusters
                 ──→ problem_edges
                 ──→ learning_path_meta (30개 직군)

══════════════════════════════════════════════════════════════
  분석 & AI 단계
══════════════════════════════════════════════════════════════

④ 목표 등록 → AI 커리큘럼 생성
   core_usergoal 생성
        ↓
   core_learningstats + core_solvehistory 참조
        ↓
   Gemini API 호출 → core_ailog 기록
        ↓
   core_curriculum (content_json에 주차별 계획 저장)

⑤ AI 매칭 점수 계산
   core_learningstats (내 언어·태그 스킬)
        ↓
   core_jobposting (공고 요구 스킬과 비교)
        ↓
   core_match (match_score 0~100 저장)

⑥ 스킬 갭 분석 & 문제 추천
   core_learningstats + core_jobposting
        ↓  AbilityCalculator (utils_ability.py)
   skill_gaps (현재수준 vs 요구수준 차이)
        ↓  추천 모델
   problem_recommendations

══════════════════════════════════════════════════════════════
  포트폴리오 & RLHF 단계
══════════════════════════════════════════════════════════════

⑦ 포트폴리오 생성
   dataset_resumes + core_learningstats + core_solvehistory
        ↓  PortfolioBuilder.build(method='gemini')
   core_portfolio + portfolio_snapshots (v1)

⑧ RLHF 피드백 루프
   사용자 포트폴리오 수정/피드백
        ↓
   portfolio_feedback (학습 데이터 축적)
        ↓  RLHFCollector.extract_training_batch()
   자체 모델 재학습
        ↓  build(method='model_v2')
   portfolio_snapshots (v2)
```

---

## 5. 로컬 DB 실행 방법

### 옵션 A — SQLite (즉시 시작, 권장)

별도 설치 없이 Django가 자동으로 `backend/db.sqlite3` 파일을 생성합니다.

```bash
cd backend
python manage.py migrate    # 테이블 자동 생성
python manage.py runserver  # 서버 시작
```

### 옵션 B — MySQL (운영 환경)

#### 1. MySQL 8.0 설치 및 DB/유저 생성

```sql
-- MySQL root 계정으로 접속 후 실행
CREATE DATABASE elaw_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'elaw_user'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON elaw_db.* TO 'elaw_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 2. `.env` 파일에 DB 설정 추가

```env
DB_NAME=elaw_db
DB_USER=elaw_user
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=3306
```

#### 3. `backend/config/settings.py` 수정

```python
# 아래 주석 처리된 MySQL 설정 블록을 활성화합니다
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.mysql',
        'NAME':     os.getenv('DB_NAME', 'elaw_db'),
        'USER':     os.getenv('DB_USER', 'elaw_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST':     os.getenv('DB_HOST', 'localhost'),
        'PORT':     os.getenv('DB_PORT', '3306'),
        'OPTIONS': {
            'charset':      'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}
```

#### 4. mysqlclient 패키지 설치

```bash
pip install mysqlclient
```

#### 5. 마이그레이션 적용

```bash
cd backend
python manage.py makemigrations --merge --no-input
python manage.py migrate
```

### 옵션 C — `setup.sh` 자동화 스크립트 (Linux/Mac)

MySQL + 마이그레이션 + 데이터 적재를 한 번에 처리합니다.

```bash
# ELAW/ 프로젝트 루트에서 실행
chmod +x DB/setup.sh
./DB/setup.sh
```

스크립트가 수행하는 작업:
1. `.env` 파일 로드
2. MySQL DB & 유저 생성
3. 가상환경 활성화
4. 패키지 설치
5. `python manage.py migrate`
6. `python manage.py fill_tables` (기업·공고·게시글 더미 데이터)
7. `python manage.py load_problems` (문제 6,000개)
8. `python manage.py load_dataset` (HuggingFace 데이터셋 2,640건)

---

## 6. 데이터 적재 방법 (Seeding)

### 기초 데이터 (기업·공고·게시글)

```bash
cd backend
python manage.py fill_tables
```

생성되는 데이터:
- 기업 3개 (카카오, 네이버, 라인플러스)
- 채용공고 여러 개
- 공지·대회·이벤트 게시글

### 문제 데이터셋 (30직군 × 200문제 = 6,000개)

```bash
python manage.py load_problems \
  --problems_dir /path/to/DB/JobProblems \
  --paths_dir   /path/to/DB/LearningPaths
```

> `DB/JobProblems/` 폴더의 JSON 파일들을 지정하면 됩니다.

### HuggingFace 데이터셋 (2,640건)

```bash
python manage.py load_dataset
# 인터넷 연결 필요, 약 5~10분 소요
```

### 특정 사용자 플랫폼 동기화

```bash
python manage.py sync_platforms --user=user@example.com
```

### 전체 적재 현황 확인

```bash
python manage.py shell -c "
from core.models import User, JobPosting, Post
print('Users:', User.objects.count())
print('JobPostings:', JobPosting.objects.count())
print('Posts:', Post.objects.count())
"
```

---

## 7. MySQL 전환 방법

현재 `backend/config/settings.py`에 MySQL 전환 코드가 주석으로 준비되어 있습니다.

### SQL 파일로 직접 스키마 생성

Django migration 대신 SQL 파일을 직접 실행하는 방법입니다.

```bash
# Step 1. 기본 12개 테이블
mysql -u elaw_user -p elaw_db < DB/sql/1_schema_base.sql

# Step 2. 데이터셋 테이블 5개
mysql -u elaw_user -p elaw_db < DB/sql/02_schema_dataset.sql

# Step 3. 확장 테이블 (스킬갭·추천·포트폴리오 스냅샷)
mysql -u elaw_user -p elaw_db < DB/sql/03_schema_new.sql

# Step 4. 문제·학습경로 테이블
mysql -u elaw_user -p elaw_db < DB/sql/04_schema_problems.sql
```

> **주의**: SQL 파일로 직접 생성한 경우, Django는 해당 테이블이 이미 존재한다고 인식하지 못할 수 있습니다. `python manage.py migrate --fake-initial` 을 사용하여 Django에 이미 적용됐음을 알려주세요.

---

## 8. 테이블 상세 설명

### core_user — 사용자 계정

```sql
email           VARCHAR(255) UNIQUE    -- 로그인 ID (이메일)
name            VARCHAR(100)           -- 표시 이름
role            VARCHAR(10)            -- student / company / admin
phone           VARCHAR(20)            -- 전화번호 (선택)
ai_consent      TINYINT(1)             -- AI 서비스 이용 동의 여부
privacy_consent TINYINT(1)             -- 개인정보 수집 동의 여부
is_active       TINYINT(1)             -- 계정 활성 여부 (탈퇴 시 0)
```

### core_curriculum — AI 생성 커리큘럼

`content_json` 컬럼에 Gemini가 생성한 커리큘럼 전체가 JSON으로 저장됩니다.

```json
{
  "total_weeks": 8,
  "field": "백엔드",
  "job_role": "백엔드 개발자",
  "weeks": [
    {
      "week": 1,
      "theme": "자료구조 기초 (스택/큐/힙)",
      "tasks": ["스택 개념 학습", "큐 구현 연습"],
      "recommended_problems": ["10828", "10845"],
      "estimated_hours": 8
    }
  ]
}
```

### core_solvehistory — 문제 풀이 이력

```sql
platform       VARCHAR(20)   -- baekjoon / programmers / w3schools / custom
problem_id     VARCHAR(50)   -- 플랫폼 내 문제 번호 (예: "1260")
status         VARCHAR(10)   -- solved / failed / partial
language       VARCHAR(50)   -- Python / Java / C++ 등
algo_tags      JSON          -- ["구현", "DP", "그래프"]
difficulty     VARCHAR(30)   -- Bronze5, Silver3, Level2 등
source         VARCHAR(10)   -- api(자동수집) / crawl / manual(직접입력)
```

### core_match — AI 매칭 결과

```sql
user_id     INT          -- 어떤 사용자의 매칭인지
posting_id  INT          -- 어떤 채용공고와 매칭인지
match_score FLOAT        -- 0~100 점수 (높을수록 적합)
status      VARCHAR(15)  -- recommended → viewed → scrapped → applied → rejected
```

### skill_gaps — 스킬 갭 분석

```sql
user_id        INT         -- 어떤 사용자의 갭인지
posting_id     INT         -- 어떤 공고를 기준으로 분석했는지
skill_name     VARCHAR(100)-- 예) Python, DP, 그래프, Django
current_level  FLOAT       -- 현재 역량 수준 (0~100)
required_level FLOAT       -- 공고 요구 수준 (0~100)
gap_score      FLOAT       -- required_level - current_level (클수록 보강 필요)
recommended_problem_ids JSON -- 갭 해소를 위해 추천된 문제 ID 배열
```

### core_ailog — AI 호출 기록

Gemini API 호출마다 자동으로 기록됩니다. 비용 추적 및 오류 디버깅에 활용됩니다.

```sql
feature        VARCHAR(20)  -- curriculum / weakness / recommendation /
                             --   portfolio / matching / problem_gen
prompt_tokens  INT          -- 입력에 사용된 토큰 수
output_tokens  INT          -- 출력에 사용된 토큰 수
latency_ms     INT          -- API 응답 시간 (밀리초)
status         VARCHAR(10)  -- success / error / timeout / cached
```

---

## ER 다이어그램 (주요 관계)

```
core_user (1) ──────────────────── (1) core_company
     │                                      │
     │ (1)                                  │ (1)
     │                                      │
     ├──── (N) core_platformlink            ├──── (N) core_jobposting
     │                                                    │
     ├──── (N) core_usergoal                              │ (N)
     │              │                                     │
     │              │ (N)              core_user (N) ─── core_match
     │              │
     ├──── (N) core_curriculum ← goal (FK)
     │
     ├──── (N) core_solvehistory ──→ (집계) ──→ core_learningstats
     │
     ├──── (N) core_portfolio ──→ portfolio_snapshots
     │                        ──→ portfolio_feedback
     │
     ├──── (N) core_post
     │
     ├──── (N) core_ailog
     │
     └──── (N) skill_gaps ──→ problem_recommendations
```

---

## 자주 묻는 질문 (FAQ)

**Q. SQLite와 MySQL 중 어떤 걸 써야 하나요?**
→ 로컬 개발은 SQLite(기본값)로 충분합니다. 팀 서버나 운영 환경에서는 MySQL로 전환하세요.

**Q. 마이그레이션 충돌이 발생해요.**
→ `python manage.py makemigrations --merge --no-input` 을 실행하면 자동으로 병합됩니다.

**Q. `job_problems` 테이블에 데이터가 없어요.**
→ `DB/JobProblems/` 폴더의 JSON 파일이 있어야 합니다. `python manage.py load_problems --problems_dir DB/JobProblems --paths_dir DB/LearningPaths` 를 실행하세요.

**Q. `dataset_entries` 테이블에 데이터를 넣으려면?**
→ 인터넷 연결 상태에서 `python manage.py load_dataset` 을 실행하면 HuggingFace에서 자동으로 2,640건을 내려받아 적재합니다.

**Q. DB 구조를 시각적으로 보고 싶어요.**
→ `DB/docs/DB_DOCUMENT.html` 파일을 브라우저로 열면 ER 다이어그램을 확인할 수 있습니다.
