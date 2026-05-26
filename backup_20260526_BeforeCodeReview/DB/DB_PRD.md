# DB PRD (Product Requirements Document)

> ELAW 플랫폼 데이터베이스 설계 및 운영 요구사항 정의서

---

## WHO — 이해관계자 및 담당 범위

### 주 담당팀
| 역할 | 담당 범위 |
|------|----------|
| **DB 팀** | 스키마 설계·마이그레이션·초기 데이터 적재·운영 DB 전환 |
| **백엔드 팀** | Django ORM을 통한 데이터 CRUD, 마이그레이션 실행 |
| **ML 팀** | `job_problems`, `learning_path_meta`, `problem_recommendations` 읽기 |

### 사용자 (간접)
- **학습자(Student)**: 풀이 이력·추천·커리큘럼 데이터의 최종 생성자이자 소비자
- **기업(Company)**: 채용공고 데이터 등록·관리
- **관리자(Admin)**: 전체 데이터 조회 및 운영 모니터링

---

## WHAT — 요구사항 및 산출물

### 핵심 산출물
| 분류 | 내용 | 규모 |
|------|------|------|
| 스키마 | 5계층 21개 테이블 | — |
| 문제 데이터 | 30개 직군 × 200문제 JSON | 6,000문제 |
| 학습경로 데이터 | 30개 직군 클러스터·엣지·순서 JSON | 직군당 ~192 클러스터, ~525 엣지 |
| HuggingFace 데이터 | 이력서-공고 쌍 | 2,640건 |
| 마이그레이션 파일 | Django migrations | 0003~0006 |
| 유틸리티 코드 | `AbilityCalculator`, `PortfolioBuilder`, `RLHFCollector` | `utils_ability.py` |

### 5계층 스키마 요구사항

**계층 1 — 기본 엔티티 (12개 테이블)**
- `core_user`: email 기반 식별자, role (student/company/admin), AI·개인정보 동의 플래그
- `core_company`: 기업 정보, `is_approved` 승인 상태
- `core_platformlink`: 외부 플랫폼 연동 (baekjoon/github/programmers), unique `(user, platform)`
- `core_usergoal`: 학습 목표, `is_active` 사용자당 최대 1개 활성 목표
- `core_curriculum`: Gemini 생성 커리큘럼, JSON 형식 주차별 계획
- `core_solvehistory`: 외부 플랫폼 풀이 이력, unique `(user, platform, problem_id)`
- `core_learningstats`: 언어·알고리즘 태그별 통계, unique `(user, stat_type, stat_key)`
- `core_portfolio`: AI 생성 포트폴리오 버전 관리
- `core_jobposting`: 채용공고, required/preferred skills JSON 배열
- `core_match`: 사용자-공고 매칭 점수 및 상태, unique `(user, posting)`
- `core_post`: 관리자 전용 공지·이벤트 게시글
- `core_ailog`: Gemini API 호출 로그 (토큰·지연시간·상태)

**계층 2 — 데이터셋 (5개 테이블)**
- HuggingFace `recuse/synthetic_resume_jd` 원본 → 파싱 이력서/공고 → 매칭 점수 (RLHF 학습 데이터)

**계층 3 — 추천·갭 분석 (2개 테이블)**
- `skill_gaps`: `gap_score = required_level - current_level` (0~100 범위)
- `problem_recommendations`: ML 모델 출력, 추천→풀이 연결 FK 추적

**계층 4 — 문제 레이어 (5개 테이블)**
- `job_problems`: 6,000문제, 난이도 분포 (university 25 / junior 25 / middle 50 / senior 100)
- `problem_edges`: `combined_score = skill_overlap × 0.55 + scenario_similarity × 0.45`
- `learning_path_meta`: 직군당 1행, ordered_path JSON

**계층 5 — 포트폴리오 RLHF (2개 테이블)**
- `portfolio_snapshots`: 생성 이력, `generation_method` 전환 추적 (gemini → model_v2)
- `portfolio_feedback`: RLHF 레이블, `used_for_training` 플래그로 배치 추출 관리

---

## WHEN — 일정 및 현재 상태

### 현재 상태
| 항목 | 상태 |
|------|------|
| SQLite 개발 DB | 완료 |
| Django migrations 0001~0006 | 완료 |
| 문제 JSON 데이터 (6,000문제) | 완료 |
| 학습경로 JSON (30개 직군) | 완료 |
| HuggingFace 데이터 적재 스크립트 | 완료 |
| 운영 MySQL 전환 | **미완료** |
| 운영 DB 서버 설정 | **미완료** |
| 초기 채용공고 더미 데이터 삽입 | **미완료** |

### 우선순위 작업
1. **P0** — 운영 MySQL DB 서버 설정 및 `.env` 구성
2. **P0** — `python manage.py migrate` 운영 환경 실행
3. **P1** — `python manage.py seed_all` + 채용공고 더미 데이터 삽입
4. **P1** — `python manage.py load_problems` + `load_dataset` 실행
5. **P2** — 운영 DB 백업 정책 수립

---

## WHERE — 범위 및 시스템 경계

### 파일 위치
```
DB/
├── sql/               # MySQL 순수 DDL (참조용)
├── migrations/        # Django migration 파일 (0003~0006)
├── JobProblems/       # 30개 직군 문제 JSON
├── LearningPaths/     # 30개 직군 학습경로 JSON
├── core/              # Django 모델 확장 코드
│   ├── models_problems.py
│   ├── models_new.py
│   └── utils_ability.py
└── docs/              # DB 설계 문서
```

### 연동 경계
| 방향 | 대상 | 방식 |
|------|------|------|
| DB → 백엔드 | `backend/core/models.py` | Django ORM |
| DB → ML | `models/curriculum/` | Django ORM 데이터 주입 |
| 외부 → DB | solved.ac, GitHub API | ETL (`core/etl/`) |
| HuggingFace → DB | `recuse/synthetic_resume_jd` | `load_dataset` 커맨드 |

### 데이터베이스 환경
- **개발**: SQLite (`backend/db.sqlite3`)
- **운영**: MySQL 8.0+, utf8mb4, InnoDB

---

## WHY — 목적 및 비즈니스 가치

### 해결하는 문제
1. **개인화 학습 경로 부재**: 사용자의 풀이 이력·스킬 수준 데이터 없이는 맞춤 추천 불가
2. **채용-학습 단절**: 채용공고 요구 스킬과 사용자 실력 간 갭을 정량화할 데이터 구조 필요
3. **AI 모델 학습 데이터 부족**: RLHF 피드백 루프를 위한 포트폴리오 생성 이력 누적 필요

### 비즈니스 가치
- **6,000개 자체 문제 데이터**: 30개 직군별 난이도·선수과목 체계화 → 차별화된 학습 콘텐츠
- **선수과목 그래프(problem_edges)**: ML 모델이 의존하는 핵심 지식 구조, 데이터 품질이 추천 정확도에 직결
- **RLHF 파이프라인**: 포트폴리오 피드백 누적 → 자체 모델(model_v2) 품질 지속 향상

### 설계 원칙
- CASCADE 삭제로 사용자 탈퇴 시 관련 데이터 자동 정리
- JSON 컬럼으로 유연한 스키마 변경 수용 (skills, curriculum 내용 등)
- Unique Constraint로 중복 데이터 방지 (풀이 이력, 플랫폼 연동 등)

---

## HOW — 구현 방법 및 기술 접근

### 초기화 절차

```bash
# 1. 환경변수 설정 (.env)
DB_NAME=elaw_db
DB_USER=elaw_user
DB_PASSWORD=***
DB_HOST=localhost
DB_PORT=3306
PROBLEMS_DIR=/path/to/DB/JobProblems
PATHS_DIR=/path/to/DB/LearningPaths

# 2. 마이그레이션
python manage.py migrate

# 3. 기초 데이터
python manage.py seed_all

# 4. 문제 데이터 적재
python manage.py load_problems                             # 전체
python manage.py load_problems --job_role "AI Engineer"   # 특정 직군
python manage.py load_problems --reset                    # 초기화 후 재적재

# 5. HuggingFace 데이터셋
python manage.py load_dataset
```

### 핵심 기술 결정

| 결정 사항 | 선택 | 이유 |
|----------|------|------|
| ORM vs Raw SQL | Django ORM + migrations 우선 | 팀 생산성, 마이그레이션 추적 |
| JSON 컬럼 | MySQL JSON 타입 | 커리큘럼·스킬 구조 유연성 |
| 선수과목 그래프 | 관계형 테이블(problem_edges) | 복잡한 그래프 DB 없이 쿼리 가능 |
| RLHF 레이블 | JSON 컬럼 (`rlhf_labels`) | 레이블 구조 변경에 유연 대응 |

### 데이터 정합성 규칙
- `core_user` 삭제 → 관련 모든 데이터 CASCADE 삭제 (단, `core_post.author`는 RESTRICT)
- `Match.status` 전이: `recommended → viewed → scrapped → applied` (단방향)
- `UserGoal.is_active`: 사용자당 동시 활성 목표 1개 (신규 생성 시 기존 비활성화)
- `portfolio_feedback.used_for_training`: 한 번 학습에 사용된 피드백은 재추출 제외
