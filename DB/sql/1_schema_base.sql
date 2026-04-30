-- ============================================================
-- 01_schema_base.sql
-- 기존 12개 테이블 MySQL 8.0+ 버전
-- 적용: mysql -u elaw_user -p elaw_db < 01_schema_base.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────
-- 1. core_user (사용자)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_user;
CREATE TABLE core_user (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password        VARCHAR(255)    NOT NULL COMMENT 'Django 해시 저장',
    name            VARCHAR(100)    NOT NULL,
    role            VARCHAR(10)     NOT NULL DEFAULT 'student'
                                    COMMENT 'student / company / admin',
    phone           VARCHAR(20)     NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    is_staff        TINYINT(1)      NOT NULL DEFAULT 0,
    is_superuser    TINYINT(1)      NOT NULL DEFAULT 0,
    ai_consent      TINYINT(1)      NOT NULL DEFAULT 0,
    privacy_consent TINYINT(1)      NOT NULL DEFAULT 0,
    last_login      DATETIME(6)     NULL,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                            ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_users_role       (role),
    INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 계정 (학생/기업/관리자)';

-- ────────────────────────────────────────
-- 2. core_company (기업)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_company;
CREATE TABLE core_company (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    industry    VARCHAR(100) NULL,
    description TEXT         NULL,
    logo_url    VARCHAR(500) NULL,
    website_url VARCHAR(500) NULL,
    is_approved TINYINT(1)   NOT NULL DEFAULT 0,
    approved_at DATETIME(6)  NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                     ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_companies_approved (is_approved),
    CONSTRAINT fk_company_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='기업 상세 정보 (users.role=company 와 1:1)';

-- ────────────────────────────────────────
-- 3. core_platformlink (플랫폼 연동)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_platformlink;
CREATE TABLE core_platformlink (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED NOT NULL,
    platform      VARCHAR(20)  NOT NULL COMMENT 'baekjoon / github / programmers',
    external_id   VARCHAR(200) NOT NULL COMMENT '플랫폼 username',
    access_token  VARCHAR(500) NULL     COMMENT 'OAuth 토큰 (암호화 저장)',
    token_expires DATETIME(6)  NULL,
    last_synced   DATETIME(6)  NULL,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                       ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_platform_user (user_id, platform),
    INDEX idx_platform_links_synced (last_synced),
    CONSTRAINT fk_platform_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='백준/GitHub/프로그래머스 연동 정보';

-- ────────────────────────────────────────
-- 4. core_usergoal (학습 목표)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_usergoal;
CREATE TABLE core_usergoal (
    id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED  NOT NULL,
    goal_type      VARCHAR(10)   NOT NULL COMMENT 'job / study',
    field          VARCHAR(100)  NULL     COMMENT '백엔드, 프론트엔드, AI 등',
    job_role       VARCHAR(100)  NULL     COMMENT '백엔드 개발자 등',
    start_date     DATE          NULL,
    end_date       DATE          NULL,
    mid_eval_date  DATE          NULL,
    duration_weeks SMALLINT UNSIGNED NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                         ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_user_goals_active (user_id, is_active),
    CONSTRAINT fk_goal_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 학습/취업 목표';

-- ────────────────────────────────────────
-- 5. core_curriculum (커리큘럼)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_curriculum;
CREATE TABLE core_curriculum (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    goal_id      INT UNSIGNED NOT NULL,
    content_json JSON         NOT NULL COMMENT 'Gemini 생성 주차별 학습 계획',
    version      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    generated_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_curricula_user_active (user_id, is_active),
    INDEX idx_curricula_goal        (goal_id),
    CONSTRAINT fk_curriculum_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_curriculum_goal FOREIGN KEY (goal_id)
        REFERENCES core_usergoal(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gemini AI 생성 학습 커리큘럼';

-- ────────────────────────────────────────
-- 6. core_solvehistory (외부 풀이 이력)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_solvehistory;
CREATE TABLE core_solvehistory (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    platform       VARCHAR(20)  NOT NULL COMMENT 'baekjoon / programmers / w3schools / custom',
    problem_id     VARCHAR(50)  NOT NULL COMMENT '플랫폼 내 문제 번호',
    problem_title  VARCHAR(300) NULL,
    status         VARCHAR(10)  NOT NULL COMMENT 'solved / failed / partial',
    language       VARCHAR(50)  NULL     COMMENT 'Python, Java, C++ 등',
    algo_tags      JSON         NULL     COMMENT '["구현","DP"]',
    difficulty     VARCHAR(30)  NULL     COMMENT 'Bronze5, Silver3 등',
    time_spent_min SMALLINT UNSIGNED NULL,
    solved_at      DATETIME(6)  NOT NULL,
    source         VARCHAR(10)  NOT NULL DEFAULT 'api' COMMENT 'api / crawl / manual',
    created_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_solve_user_platform_problem (user_id, platform, problem_id),
    INDEX idx_solve_user_solved_at (user_id, solved_at DESC),
    INDEX idx_solve_platform       (platform),
    INDEX idx_solve_language       (language),
    CONSTRAINT fk_solve_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='외부 플랫폼(백준/프로그래머스) 풀이 이력';

-- ────────────────────────────────────────
-- 7. core_learningstats (학습 통계)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_learningstats;
CREATE TABLE core_learningstats (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    stat_type      VARCHAR(15)  NOT NULL COMMENT 'language / algo_tag',
    stat_key       VARCHAR(100) NOT NULL COMMENT '"Python" 또는 "구현"',
    total_count    INT UNSIGNED NOT NULL DEFAULT 0,
    solved_count   INT UNSIGNED NOT NULL DEFAULT 0,
    failed_count   INT UNSIGNED NOT NULL DEFAULT 0,
    correct_rate   FLOAT        NULL     COMMENT 'solved/total*100',
    last_solved_at DATETIME(6)  NULL,
    updated_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                         ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_stats_user_type_key (user_id, stat_type, stat_key),
    INDEX idx_stats_correct_rate      (user_id, correct_rate),
    CONSTRAINT fk_stats_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='언어/알고리즘 태그별 학습 통계';

-- ────────────────────────────────────────
-- 8. core_portfolio (포트폴리오)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_portfolio;
CREATE TABLE core_portfolio (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    title        VARCHAR(300) NOT NULL DEFAULT '나의 포트폴리오',
    summary_text TEXT         NULL,
    content_json JSON         NULL,
    public_slug  VARCHAR(120) UNIQUE NULL COMMENT '공개 URL: /portfolio/{slug}',
    pdf_path     VARCHAR(500) NULL,
    language     VARCHAR(5)   NOT NULL DEFAULT 'ko' COMMENT 'ko / en',
    version      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    is_public    TINYINT(1)   NOT NULL DEFAULT 1,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                       ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_portfolios_user_id (user_id),
    INDEX idx_portfolios_public  (is_public, created_at DESC),
    CONSTRAINT fk_portfolio_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 포트폴리오 (여러 버전은 portfolio_snapshots에)';

-- ────────────────────────────────────────
-- 9. core_jobposting (채용공고)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_jobposting;
CREATE TABLE core_jobposting (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id       INT UNSIGNED NOT NULL,
    title            VARCHAR(300) NOT NULL,
    description      TEXT         NULL,
    required_skills  JSON         NULL COMMENT '["Python","Django"]',
    preferred_skills JSON         NULL,
    job_role         VARCHAR(100) NULL,
    career_level     VARCHAR(10)  NOT NULL DEFAULT 'any'
                                  COMMENT 'new / junior / senior / any',
    deadline         DATE         NULL,
    is_active        TINYINT(1)   NOT NULL DEFAULT 1,
    view_count       INT UNSIGNED NOT NULL DEFAULT 0,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                           ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_job_postings_company  (company_id, is_active),
    INDEX idx_job_postings_role     (job_role),
    INDEX idx_job_postings_deadline (deadline, is_active),
    CONSTRAINT fk_posting_company FOREIGN KEY (company_id)
        REFERENCES core_company(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='기업 채용공고';

-- ────────────────────────────────────────
-- 10. core_match (매칭)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_match;
CREATE TABLE core_match (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    posting_id  INT UNSIGNED NOT NULL,
    match_score FLOAT        NULL COMMENT 'AI 매칭 점수 (0~100)',
    status      VARCHAR(15)  NOT NULL DEFAULT 'recommended'
                             COMMENT 'recommended/viewed/scrapped/applied/rejected',
    applied_at  DATETIME(6)  NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                     ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_match_user_posting    (user_id, posting_id),
    INDEX idx_matches_user_score        (user_id, match_score DESC),
    INDEX idx_matches_posting_status    (posting_id, status),
    CONSTRAINT fk_match_user    FOREIGN KEY (user_id)    REFERENCES core_user(id)       ON DELETE CASCADE,
    CONSTRAINT fk_match_posting FOREIGN KEY (posting_id) REFERENCES core_jobposting(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자-채용공고 AI 매칭 결과';

-- ────────────────────────────────────────
-- 11. core_post (게시글)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_post;
CREATE TABLE core_post (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    author_id  INT UNSIGNED NOT NULL,
    category   VARCHAR(10)  NOT NULL COMMENT 'notice / contest / event',
    title      VARCHAR(300) NOT NULL,
    content    TEXT         NOT NULL,
    is_pinned  TINYINT(1)   NOT NULL DEFAULT 0,
    view_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                     ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_posts_category_date (category, created_at DESC),
    INDEX idx_posts_pinned        (is_pinned, created_at DESC),
    CONSTRAINT fk_post_author FOREIGN KEY (author_id)
        REFERENCES core_user(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='공지/대회/이벤트 게시글';

-- ────────────────────────────────────────
-- 12. core_ailog (AI 호출 기록)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS core_ailog;
CREATE TABLE core_ailog (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED NULL,
    feature       VARCHAR(20)  NOT NULL
                  COMMENT 'curriculum/weakness/recommendation/portfolio/matching/problem_gen',
    prompt_tokens INT UNSIGNED NULL,
    output_tokens INT UNSIGNED NULL,
    latency_ms    INT UNSIGNED NULL COMMENT 'API 응답 시간(ms)',
    status        VARCHAR(10)  NOT NULL DEFAULT 'success'
                  COMMENT 'success / error / timeout / cached',
    error_message VARCHAR(500) NULL,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_ai_logs_user_feature (user_id, feature),
    INDEX idx_ai_logs_created_at   (created_at DESC),
    INDEX idx_ai_logs_status       (status),
    CONSTRAINT fk_ailog_user FOREIGN KEY (user_id)
        REFERENCES core_user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gemini API 호출 기록 및 비용 추적';

SET FOREIGN_KEY_CHECKS = 1;

-- ── 적재 확인 ──────────────────────────────
SELECT
    table_name,
    table_comment,
    table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'core_user','core_company','core_platformlink','core_usergoal',
    'core_curriculum','core_solvehistory','core_learningstats',
    'core_portfolio','core_jobposting','core_match','core_post','core_ailog'
  )
ORDER BY table_name;