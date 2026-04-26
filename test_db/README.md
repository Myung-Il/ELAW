# ELAW 데이터베이스 (test_db)

## 팀 역할
이 폴더는 **DB 팀** 전용입니다.
테이블 스키마 설계, 마이그레이션, 시드 데이터 관리를 담당합니다.

## 기술 스택
- DBMS: PostgreSQL 15+
- 마이그레이션: Django ORM (test_be/apps/*/models.py 기반)
- 개발 DB: 로컬 PostgreSQL 또는 Docker

## 폴더 구조

```
test_db/
├── schemas/
│   └── create_tables.sql     ← 전체 테이블 생성 DDL (참고용)
├── seeds/
│   ├── departments.sql       ← 학과 초기 데이터
│   ├── companies.sql         ← 기업 초기 데이터
│   ├── study_topics.sql      ← 공부 주제 초기 데이터
│   └── job_fields.sql        ← 직무 분야 초기 데이터
├── migrations/               ← 수동 마이그레이션 스크립트 (Django 자동 생성 외 추가 작업)
└── .env.example              ← DB 연결 정보 예시
```

## DB 실행 방법 (Docker)

```bash
# PostgreSQL 컨테이너 실행
docker run --name elaw-db \
  -e POSTGRES_DB=elaw_db \
  -e POSTGRES_USER=elaw_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15

# 스키마 적용
psql -h localhost -U elaw_user -d elaw_db -f schemas/create_tables.sql

# 초기 데이터 삽입
psql -h localhost -U elaw_user -d elaw_db -f seeds/departments.sql
psql -h localhost -U elaw_user -d elaw_db -f seeds/companies.sql
```

## 테이블 목록 및 역할

### users (사용자)
- `id` BIGSERIAL PK
- `username` VARCHAR(150) UNIQUE - 로그인 아이디
- `password` VARCHAR(256) - bcrypt 해시
- `name` VARCHAR(100) - 실명
- `dept` VARCHAR(100) - 학과
- `year` VARCHAR(20) - 학년
- `phone` VARCHAR(20) - 전화번호
- `email` VARCHAR(254) UNIQUE
- `created_at` TIMESTAMPTZ

### user_goals (사용자 목표 - 최초 로그인 시 설정)
- `id` BIGSERIAL PK
- `user_id` BIGINT FK → users.id
- `job_field` VARCHAR(100) - 희망 직무
- `is_first_setup` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMPTZ

### companies (기업)
- `id` BIGSERIAL PK
- `name` VARCHAR(200)
- `field` VARCHAR(100) - 산업 분야
- `description` TEXT
- `apply_url` VARCHAR(500) - 채용 지원 페이지 URL
- `logo` VARCHAR(10) - 로고 텍스트 (S, K 등)
- `color` VARCHAR(50) - 로고 배경색
- `is_partner` BOOLEAN - 파트너 기업 여부
- `founded_year` VARCHAR(20)
- `employee_count` VARCHAR(50)

### job_postings (채용 공고)
- `id` BIGSERIAL PK
- `company_id` BIGINT FK → companies.id
- `title` VARCHAR(300) - 직무명
- `description` TEXT - 직무 설명
- `requirements` TEXT[] - 지원 자격 (배열)
- `preferences` TEXT[] - 우대 사항
- `benefits` TEXT[] - 복리후생
- `tech_stack` TEXT[] - 기술 스택
- `positions` INTEGER - 모집 인원
- `deadline` DATE - 마감일
- `location` VARCHAR(200)
- `status` VARCHAR(20) - 공고 상태 (active/closed)

### curriculum_weeks (커리큘럼 주차 정의)
- `id` BIGSERIAL PK
- `week_number` INTEGER
- `title` VARCHAR(200) - 주제명
- `topics` TEXT[] - 세부 주제 목록
- `problems` INTEGER - 문제 수
- `hours` INTEGER - 예상 학습 시간
- `order` INTEGER

### user_curriculum (사용자 커리큘럼)
- `id` BIGSERIAL PK
- `user_id` BIGINT FK → users.id
- `week_id` BIGINT FK → curriculum_weeks.id
- `status` VARCHAR(20) - completed/in-progress/locked
- `completed_at` TIMESTAMPTZ

### study_topics (공부 주제)
- `id` BIGSERIAL PK
- `title` VARCHAR(200)
- `category` VARCHAR(100)
- `description` TEXT
- `difficulty` VARCHAR(10) - 하/중/상
- `problems` INTEGER
- `estimated_hours` INTEGER

### board_posts (게시판 글)
- `id` BIGSERIAL PK
- `author_id` BIGINT FK → users.id
- `title` VARCHAR(500)
- `content` TEXT
- `category` VARCHAR(20) - 공지/행사/QnA
- `views` INTEGER DEFAULT 0
- `likes` INTEGER DEFAULT 0
- `is_pinned` BOOLEAN DEFAULT FALSE
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `deleted_at` TIMESTAMPTZ - soft delete

### board_comments (게시판 댓글)
- `id` BIGSERIAL PK
- `post_id` BIGINT FK → board_posts.id
- `author_id` BIGINT FK → users.id
- `content` TEXT
- `likes` INTEGER DEFAULT 0
- `created_at` TIMESTAMPTZ
- `deleted_at` TIMESTAMPTZ - soft delete

### portfolios (포트폴리오)
- `id` BIGSERIAL PK
- `user_id` BIGINT FK → users.id
- `job_id` BIGINT FK → job_postings.id
- `intro` TEXT - 자기소개
- `skills` TEXT[] - 스킬 목록
- `experiences` JSONB - 경력/활동 목록
- `projects` JSONB - 프로젝트 목록
- `is_submitted` BOOLEAN DEFAULT FALSE
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

### applications (지원 현황)
- `id` BIGSERIAL PK
- `user_id` BIGINT FK → users.id
- `job_id` BIGINT FK → job_postings.id
- `status` VARCHAR(20) - pending/passed/failed/interviewing
- `applied_at` TIMESTAMPTZ

### company_pass_stats (기업 합격자 통계 - AI 비교용)
- `id` BIGSERIAL PK
- `company_id` BIGINT FK → companies.id
- `topic` VARCHAR(100) - 과목명
- `avg_proficiency` INTEGER - 합격자 평균 숙련도 (0-100)
- `year` INTEGER - 기준 연도

## 주의사항
- 비밀번호는 절대 평문으로 저장하지 말 것 (bcrypt 해시 사용)
- soft delete 패턴 사용 (deleted_at 컬럼)
- 모든 외래키에 인덱스 추가 필수
- 배포 환경에서는 connection pool 설정 필수