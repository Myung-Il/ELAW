-- ============================================================
-- 04_schema_problems.sql
-- 문제 데이터셋 & 연관도 테이블 5개 (MySQL 8.0+)
-- 적용: mysql -u elaw_user -p elaw_db < 04_schema_problems.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────
-- 1. job_problems (6,000개 문제)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS job_problems;
CREATE TABLE job_problems (
    id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    original_question_id SMALLINT UNSIGNED NOT NULL COMMENT '파일 내 question_id (1~200)',
    job_role             VARCHAR(100)      NOT NULL COMMENT '예) AI Engineer',
    difficulty           VARCHAR(20)       NOT NULL COMMENT 'university_level/junior_level/middle_level/senior_level',
    question_type        VARCHAR(20)       NULL     COMMENT 'definition/application/debugging/design/analysis/coding',
    category             VARCHAR(100)      NOT NULL COMMENT '예) Machine Learning',
    subcategory          VARCHAR(100)      NULL     COMMENT '예) Evaluation',
    skills_required      JSON              NOT NULL COMMENT '["Metrics","ROC AUC"]',
    scenario             TEXT              NULL     COMMENT '문제 상황',
    question             TEXT              NOT NULL COMMENT '문제 본문',
    choices              JSON              NOT NULL COMMENT '객관식 선택지 배열',
    correct_answer       VARCHAR(300)      NOT NULL,
    explanation          TEXT              NULL,
    -- 전체 사용자 통계 (집계 갱신)
    total_attempts       INT UNSIGNED      NOT NULL DEFAULT 0,
    correct_count        INT UNSIGNED      NOT NULL DEFAULT 0,
    avg_correct_rate     FLOAT             NULL     COMMENT '전체 평균 정답률 (%)',
    created_at           DATETIME(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                    ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_jp_role_qid  (job_role, original_question_id),
    INDEX idx_jp_job_role      (job_role),
    INDEX idx_jp_difficulty    (difficulty),
    INDEX idx_jp_category      (category, subcategory),
    INDEX idx_jp_qtype         (question_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='30개 직군 × 200문제 = 6,000개 자체 문제 데이터셋';

-- ────────────────────────────────────────
-- 2. job_problem_clusters
-- ────────────────────────────────────────
DROP TABLE IF EXISTS job_problem_clusters;
CREATE TABLE job_problem_clusters (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role            VARCHAR(100)      NOT NULL,
    cluster_id          VARCHAR(200)      NOT NULL COMMENT '예) Deep Learning__Optimization',
    category            VARCHAR(100)      NOT NULL,
    subcategory         VARCHAR(100)      NULL,
    size                SMALLINT UNSIGNED NOT NULL COMMENT '클러스터 내 문제 수',
    question_ids        JSON              NOT NULL COMMENT 'original_question_id 배열',
    common_skills       JSON              NULL     COMMENT '공통 스킬 배열',
    -- 생성 파라미터
    skill_weight        FLOAT             NOT NULL DEFAULT 0.6,
    scenario_weight     FLOAT             NOT NULL DEFAULT 0.4,
    min_combined_score  FLOAT             NOT NULL DEFAULT 0.15,
    same_category_bonus FLOAT             NOT NULL DEFAULT 0.1,
    created_at          DATETIME(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_jpc_role_cluster (job_role, cluster_id),
    INDEX idx_jpc_job_role         (job_role),
    INDEX idx_jpc_category         (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='직군별 문제 클러스터 (category+subcategory 기준 묶음)';

-- ────────────────────────────────────────
-- 3. problem_edges (선수과목 관계)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS problem_edges;
CREATE TABLE problem_edges (
    id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role             VARCHAR(100)      NOT NULL,
    source_problem_id    BIGINT UNSIGNED   NOT NULL COMMENT '선수 문제',
    target_problem_id    BIGINT UNSIGNED   NOT NULL COMMENT '후속 문제',
    combined_score       FLOAT             NOT NULL COMMENT '스킬+시나리오 가중합산 점수',
    skill_overlap        FLOAT             NULL     COMMENT '스킬 겹침 정도 (0~1)',
    scenario_similarity  FLOAT             NULL     COMMENT '시나리오 유사도 (0~1)',
    is_prerequisite      TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '선수과목 여부',
    created_at           DATETIME(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_pe_src_tgt       (source_problem_id, target_problem_id),
    INDEX idx_pe_job_role          (job_role),
    INDEX idx_pe_is_prerequisite   (is_prerequisite),
    INDEX idx_pe_combined_score    (combined_score DESC),
    INDEX idx_pe_target            (target_problem_id),
    CONSTRAINT fk_pe_source FOREIGN KEY (source_problem_id) REFERENCES job_problems(id) ON DELETE CASCADE,
    CONSTRAINT fk_pe_target FOREIGN KEY (target_problem_id) REFERENCES job_problems(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='문제 간 선수과목/연관 관계 그래프 엣지';

-- ────────────────────────────────────────
-- 4. learning_path_meta
-- ────────────────────────────────────────
DROP TABLE IF EXISTS learning_path_meta;
CREATE TABLE learning_path_meta (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role                VARCHAR(100)      NOT NULL UNIQUE,
    source_file             VARCHAR(200)      NOT NULL,
    total_problems          SMALLINT UNSIGNED NOT NULL,
    cluster_count           SMALLINT UNSIGNED NOT NULL,
    edge_count              SMALLINT UNSIGNED NOT NULL,
    isolated_problem_count  SMALLINT UNSIGNED NOT NULL,
    difficulty_distribution JSON              NOT NULL,
    -- 생성 파라미터
    skill_weight            FLOAT NOT NULL DEFAULT 0.6,
    scenario_weight         FLOAT NOT NULL DEFAULT 0.4,
    min_combined_score      FLOAT NOT NULL DEFAULT 0.15,
    max_prereqs_per_target  SMALLINT UNSIGNED NOT NULL DEFAULT 3,
    same_category_bonus     FLOAT NOT NULL DEFAULT 0.1,
    loaded_at               DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                               ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_lpm_job_role (job_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='직군별 LearningPath 생성 메타 정보 (30행)';

-- ────────────────────────────────────────
-- 5. job_problem_solve_history
-- ────────────────────────────────────────
DROP TABLE IF EXISTS job_problem_solve_history;
CREATE TABLE job_problem_solve_history (
    id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              INT             NOT NULL,
    problem_id           BIGINT UNSIGNED NOT NULL,
    status               VARCHAR(10)     NOT NULL COMMENT 'correct / incorrect / skipped',
    selected_answer      VARCHAR(300)    NULL     COMMENT '사용자 선택 답',
    time_spent_sec       SMALLINT UNSIGNED NULL   COMMENT '풀이 소요 시간(초)',
    from_recommendation_id BIGINT UNSIGNED NULL   COMMENT '어떤 추천을 통해 풀었는지',
    solved_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_jpsh_user_time    (user_id, solved_at DESC),
    INDEX idx_jpsh_user_status  (user_id, status),
    INDEX idx_jpsh_problem      (problem_id),
    CONSTRAINT fk_jpsh_user    FOREIGN KEY (user_id)    REFERENCES core_user(id)                ON DELETE CASCADE,
    CONSTRAINT fk_jpsh_problem FOREIGN KEY (problem_id) REFERENCES job_problems(id)             ON DELETE CASCADE,
    CONSTRAINT fk_jpsh_rec     FOREIGN KEY (from_recommendation_id) REFERENCES problem_recommendations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자의 자체 문제 풀이 이력';

SET FOREIGN_KEY_CHECKS = 1;

-- ── 적재 확인 ──────────────────────────────
SELECT
    table_name,
    table_comment,
    table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
      'job_problems',
      'job_problem_clusters',
      'problem_edges',
      'learning_path_meta',
      'job_problem_solve_history'
  )
ORDER BY table_name;