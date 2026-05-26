# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 역할

`DB/` 폴더는 ELAW 플랫폼의 **데이터베이스 스키마, 문제 데이터셋, Django 모델 확장 레이어**를 관리한다. Django 앱(`backend/core/`)과는 별도로 DB 설계 전용 코드와 원본 데이터를 보관한다.

## 초기화 순서

```bash
# MySQL 환경 기준 전체 초기화 (setup.sh 참고)
# 1. MySQL DB/User 생성
# 2. .env 설정 (DB_NAME, DB_USER, DB_PASSWORD, PROBLEMS_DIR, PATHS_DIR)
# 3. Django migrations 적용
python manage.py migrate

# 4. 문제 데이터 적재 (JobProblems/ + LearningPaths/ 디렉터리 필요)
python manage.py load_problems                      # 전체 30개 직군
python manage.py load_problems --job_role "AI Engineer"  # 특정 직군만
python manage.py load_problems --reset              # 초기화 후 재적재

# 5. HuggingFace 데이터셋 적재
python manage.py load_dataset

# 6. 기초 데이터 (기업, 공고, 게시글)
python manage.py seed_all
```

## 폴더 구조

```
DB/
├── core/                     # Django 모델 확장 레이어 (backend/core/에 통합 예정)
│   ├── models_problems.py    # 문제 레이어 5개 모델
│   ├── models_new.py         # 추천·포트폴리오 레이어 4개 모델
│   ├── models_register.py    # __all__ 등록
│   ├── utils_ability.py      # AbilityCalculator, PortfolioBuilder, RLHFCollector
│   └── management/commands/load_problems.py
├── migrations/               # 추가 migration 파일 (0003~0006)
├── sql/                      # 순수 SQL 스키마 (MySQL 8.0+)
├── JobProblems/              # 30개 직군 × 200문제 JSON (총 6,000문제)
├── LearningPaths/            # 30개 직군 학습경로 JSON (클러스터·엣지·순서)
└── docs/                     # DB 설계 문서 (HTML, PDF, README)
```

## 스키마 계층 구조

### 계층 1 — 기본 테이블 12개 (`sql/1_schema_base.sql`)
핵심 엔티티: `core_user`, `core_company`, `core_platformlink`, `core_usergoal`, `core_curriculum`, `core_solvehistory`, `core_learningstats`, `core_portfolio`, `core_jobposting`, `core_match`, `core_post`, `core_ailog`

### 계층 2 — 데이터셋 테이블 5개 (`sql/02_schema_dataset.sql`)
HuggingFace `recuse/synthetic_resume_jd` 2,640건 저장:
`dataset_entries` → `dataset_resumes` + `dataset_job_descriptions` → `dataset_match_scores`

### 계층 3 — 추천·갭 분석 2개 (`sql/03_schema_new.sql`)
- `skill_gaps`: 사용자의 스킬 현재/요구 수준 비교, `gap_score = required_level - current_level`
- `problem_recommendations`: ML 모델 출력 저장, `status (pending/solved/skipped)` 추적

### 계층 4 — 문제 레이어 5개 (`sql/04_schema_problems.sql`)
- `job_problems`: 6,000문제 (30직군 × 200문제), unique key `(job_role, original_question_id)`
- `job_problem_clusters`: 직군별 category+subcategory 클러스터
- `problem_edges`: 선수과목 방향 그래프, `combined_score = skill_overlap × 0.55 + scenario_similarity × 0.45`
- `learning_path_meta`: 직군당 1행, `ordered_path` 생성 파라미터 보관
- `job_problem_solve_history`: 사용자 풀이 기록, `from_recommendation_id` FK로 추천→풀이 추적

### 계층 5 — 포트폴리오 RLHF 2개
- `portfolio_snapshots`: 포트폴리오 버전 이력, `generation_method (gemini/model_v1/model_v2/manual)`
- `portfolio_feedback`: RLHF 피드백, `used_for_training` 플래그로 배치 추출 관리

## JSON 데이터 형식

### `JobProblems/{job_role}.json`
```json
{
  "question_id": 1,
  "job_role": "AI Engineer",
  "difficulty": "university_level",
  "question_type": "definition",
  "category": "Machine Learning",
  "subcategory": "Evaluation",
  "skills_required": ["Metrics"],
  "scenario": "...",
  "question": "...",
  "choices": ["A", "B", "C", "D"],
  "correct_answer": "Recall",
  "explanation": "..."
}
```
난이도 분포: `university=25, junior=25, middle=50, senior=100`

### `LearningPaths/{job_role}_path.json`
```json
{
  "metadata": { "job_role": "...", "cluster_count": 192, "edge_count": 525,
                "parameters": { "skill_weight": 0.55, "scenario_weight": 0.45,
                                "min_combined_score": 0.2, "max_prereqs_per_target": 3 } },
  "clusters": [{ "cluster_id": "Deep Learning__Optimization", "question_ids": [2, 20, 27] }],
  "edges":    [{ "source_problem_id": 1, "target_problem_id": 5,
                 "combined_score": 0.75, "is_prerequisite": true }]
}
```

## 주요 유틸리티 클래스 (`utils_ability.py`)

| 클래스 | 역할 |
|--------|------|
| `AbilityCalculator` | solved.ac + 자체 문제 풀이 통합 → 스킬 수준(0~100) 산출 |
| `PortfolioBuilder` | Gemini/모델 기반 포트폴리오 생성·버전 관리 |
| `RLHFCollector` | `portfolio_feedback` 수집·배치 추출, `used_for_training` 플래그 관리 |

## 설계 원칙

- **MySQL 8.0+ utf8mb4**: 모든 테이블 한글 지원
- **CASCADE 삭제**: `user` 삭제 시 연관 데이터 자동 삭제 (단, `core_post.author`는 RESTRICT)
- **JSON 컬럼**: 파싱 결과·통계·피드백 등 유연한 구조 저장
- **복합 Unique Key**: 중복 방지 (예: `(user, platform)`, `(job_role, original_question_id)`)
- **created_at / updated_at**: 모든 테이블에 DATETIME(6) 타임스탬프 포함

## 30개 지원 직군

AI Engineer, AR&VR Engineer, Backend Engineer, Big Data Engineer, Blockchain Engineer, Cloud Infrastructure Engineer, Computer Vision Engineer, Data Engineer, Database Administrator, Data Scientist, DevOps Engineer, Embedded Systems Engineer, Frontend Developer, Full Stack Engineer, Game Developer, IoT Engineer, Machine Learning Researcher, Mobile App Developer, NLP Engineer, Network Engineer, QA Engineer, Research Scientist, Robotics Engineer, Security Engineer, Site Reliability Engineer (SRE), Software Architect, Software Engineer, Systems Engineer, Technical Program Manager, UI&UX Engineer
