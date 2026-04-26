-- ELAW 전체 테이블 DDL
-- 작업자: DB 팀
-- 이 파일을 수정하여 테이블 구조를 변경하세요
-- 실행: psql -h localhost -U elaw_user -d elaw_db -f schemas/create_tables.sql

-- ─── 확장 기능 활성화 ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- bcrypt 지원

-- ─── 사용자 테이블 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           BIGSERIAL PRIMARY KEY,
    username     VARCHAR(150) NOT NULL UNIQUE,         -- 로그인 아이디
    password     VARCHAR(256) NOT NULL,                -- bcrypt 해시 저장
    name         VARCHAR(100) NOT NULL,                -- 실명
    dept         VARCHAR(100) DEFAULT '',              -- 학과
    year         VARCHAR(20)  DEFAULT '',              -- 학년
    phone        VARCHAR(20)  DEFAULT '',              -- 전화번호
    email        VARCHAR(254) UNIQUE,                  -- 이메일 (선택)
    is_active    BOOLEAN      DEFAULT TRUE,
    is_staff     BOOLEAN      DEFAULT FALSE,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- 사용자 목표 설정
CREATE TABLE IF NOT EXISTS user_goals (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_field       VARCHAR(100) NOT NULL,             -- 희망 직무
    is_first_setup  BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (user_id)
);

-- ─── 기업 테이블 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    field          VARCHAR(100) NOT NULL,              -- 산업 분야
    description    TEXT         DEFAULT '',
    apply_url      VARCHAR(500) DEFAULT '',            -- 채용 지원 페이지 URL
    logo           VARCHAR(10)  DEFAULT '',
    color          VARCHAR(50)  DEFAULT '',
    is_partner     BOOLEAN      DEFAULT FALSE,
    founded_year   VARCHAR(20)  DEFAULT '',
    employee_count VARCHAR(50)  DEFAULT '',
    website        VARCHAR(500) DEFAULT '',
    location       VARCHAR(200) DEFAULT '',
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- 채용 공고
CREATE TABLE IF NOT EXISTS job_postings (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title        VARCHAR(300) NOT NULL,
    description  TEXT         DEFAULT '',
    requirements TEXT[]       DEFAULT '{}',
    preferences  TEXT[]       DEFAULT '{}',
    benefits     TEXT[]       DEFAULT '{}',
    tech_stack   TEXT[]       DEFAULT '{}',
    positions    INTEGER      DEFAULT 0,
    deadline     DATE,
    location     VARCHAR(200) DEFAULT '',
    status       VARCHAR(20)  DEFAULT 'active',        -- active / closed
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 커리큘럼 테이블 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curriculum_weeks (
    id           BIGSERIAL PRIMARY KEY,
    week_number  INTEGER      NOT NULL,
    title        VARCHAR(200) NOT NULL,
    topics       TEXT[]       DEFAULT '{}',
    problems     INTEGER      DEFAULT 0,
    hours        INTEGER      DEFAULT 0,
    order_idx    INTEGER      DEFAULT 0
);

-- 사용자별 커리큘럼 진행 상태
CREATE TABLE IF NOT EXISTS user_curriculum (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_id      BIGINT      NOT NULL REFERENCES curriculum_weeks(id),
    status       VARCHAR(20)  DEFAULT 'locked',        -- completed / in-progress / locked
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (user_id, week_id)
);

-- ─── 공부 주제 테이블 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_topics (
    id               BIGSERIAL PRIMARY KEY,
    title            VARCHAR(200) NOT NULL,
    category         VARCHAR(100) NOT NULL,
    description      TEXT         DEFAULT '',
    difficulty       VARCHAR(10)  DEFAULT '중',        -- 하 / 중 / 상
    problems         INTEGER      DEFAULT 0,
    estimated_hours  INTEGER      DEFAULT 0
);

-- ─── 게시판 테이블 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_posts (
    id           BIGSERIAL PRIMARY KEY,
    author_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title        VARCHAR(500) NOT NULL,
    content      TEXT         NOT NULL,
    category     VARCHAR(20)  NOT NULL DEFAULT 'QnA',  -- 공지 / 행사 / QnA
    views        INTEGER      DEFAULT 0,
    likes        INTEGER      DEFAULT 0,
    is_pinned    BOOLEAN      DEFAULT FALSE,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ                           -- soft delete
);

CREATE TABLE IF NOT EXISTS board_comments (
    id           BIGSERIAL PRIMARY KEY,
    post_id      BIGINT      NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
    author_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    content      TEXT         NOT NULL,
    likes        INTEGER      DEFAULT 0,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ                           -- soft delete
);

-- ─── 포트폴리오 테이블 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolios (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id       BIGINT               REFERENCES job_postings(id) ON DELETE SET NULL,
    intro        TEXT         DEFAULT '',
    skills       TEXT[]       DEFAULT '{}',
    experiences  JSONB        DEFAULT '[]',
    projects     JSONB        DEFAULT '[]',
    is_submitted BOOLEAN      DEFAULT FALSE,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 지원 현황 테이블 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id       BIGINT               REFERENCES job_postings(id) ON DELETE SET NULL,
    status       VARCHAR(20)  DEFAULT 'pending',       -- pending / passed / failed / interviewing
    applied_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 기업 합격자 통계 (AI 비교용) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_pass_stats (
    id               BIGSERIAL PRIMARY KEY,
    company_id       BIGINT      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    topic            VARCHAR(100) NOT NULL,
    avg_proficiency  INTEGER      DEFAULT 0,           -- 합격자 평균 숙련도 0-100
    year             INTEGER      NOT NULL,
    UNIQUE (company_id, topic, year)
);

-- ─── 인덱스 ─────────────────────────────────────────────────────────────
-- 성능 최적화를 위한 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_curriculum_user_id ON user_curriculum(user_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_company_id ON job_postings(company_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_category ON board_posts(category);
CREATE INDEX IF NOT EXISTS idx_board_posts_created_at ON board_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);

-- 완료
-- 다음 단계: seeds/ 폴더의 초기 데이터 SQL 실행