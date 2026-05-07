-- ============================================================
-- 03_schema_new.sql
-- 신규 테이블 4개 (MySQL 8.0+)
-- 적용: mysql -u elaw_user -p elaw_db < 03_schema_new.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────
-- 1. skill_gaps  (문제 추천보다 먼저 생성)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS skill_gaps;
CREATE TABLE skill_gaps (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT            NOT NULL COMMENT 'core_user.id FK',
    posting_id              INT            NULL     COMMENT 'core_jobposting.id FK (SET NULL)',
    skill_name              VARCHAR(100)   NOT NULL COMMENT '예) Python, DP, 그래프',
    skill_category          VARCHAR(30)    NULL     COMMENT 'language / algo_tag / framework',
    current_level           FLOAT          NOT NULL COMMENT '현재 역량 수준 (0~100)',
    required_level          FLOAT          NOT NULL COMMENT '공고 요구 수준 (0~100)',
    gap_score               FLOAT          NOT NULL COMMENT 'required - current',
    recommended_problem_ids JSON           NULL     COMMENT '갭 해소용 추천 문제 ID 배열',
    calculation_method      VARCHAR(50)    NOT NULL DEFAULT 'rule_based',
    calculated_at           DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                    ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_sg_user_posting_skill (user_id, posting_id, skill_name),
    INDEX idx_sg_user_posting  (user_id, posting_id),
    INDEX idx_sg_gap_score     (gap_score DESC),
    INDEX idx_sg_category      (skill_category),
    CONSTRAINT fk_sg_user    FOREIGN KEY (user_id)    REFERENCES core_user(id)        ON DELETE CASCADE,
    CONSTRAINT fk_sg_posting FOREIGN KEY (posting_id) REFERENCES core_jobposting(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 스킬 갭 분석 결과';

-- ────────────────────────────────────────
-- 2. problem_recommendations
-- ────────────────────────────────────────
DROP TABLE IF EXISTS problem_recommendations;
CREATE TABLE problem_recommendations (
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id          INT            NOT NULL,
    posting_id       INT            NULL     COMMENT '어떤 공고를 목표로 추천됐는지',
    skill_gap_id     BIGINT UNSIGNED NULL    COMMENT '어떤 갭을 채우기 위한 추천인지',
    problem_id       VARCHAR(100)   NOT NULL COMMENT '플랫폼 내 문제 ID',
    platform         VARCHAR(20)    NOT NULL COMMENT 'baekjoon / programmers / leetcode',
    title            VARCHAR(300)   NULL,
    algo_tags        JSON           NULL     COMMENT '["DP", "그래프"]',
    difficulty       VARCHAR(30)    NULL     COMMENT 'Bronze5, Silver3, Level2 등',
    relevance_score  FLOAT          NOT NULL COMMENT '추천 관련성 점수 (0~1)',
    reason           TEXT           NULL     COMMENT '추천 이유',
    model_version    VARCHAR(50)    NOT NULL DEFAULT 'v1.0',
    status           VARCHAR(10)    NOT NULL DEFAULT 'pending'
                                            COMMENT 'pending / solved / skipped',
    recommended_at   DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    solved_at        DATETIME(6)    NULL,
    UNIQUE KEY uq_pr_user_platform_problem_posting (user_id, platform, problem_id, posting_id),
    INDEX idx_pr_user_status    (user_id, status),
    INDEX idx_pr_user_posting   (user_id, posting_id),
    INDEX idx_pr_relevance      (relevance_score DESC),
    INDEX idx_pr_recommended_at (recommended_at),
    CONSTRAINT fk_pr_user      FOREIGN KEY (user_id)      REFERENCES core_user(id)         ON DELETE CASCADE,
    CONSTRAINT fk_pr_posting   FOREIGN KEY (posting_id)   REFERENCES core_jobposting(id)   ON DELETE SET NULL,
    CONSTRAINT fk_pr_skill_gap FOREIGN KEY (skill_gap_id) REFERENCES skill_gaps(id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='문제 추천 모델 출력 결과';

-- ────────────────────────────────────────
-- 3. portfolio_snapshots
-- ────────────────────────────────────────
DROP TABLE IF EXISTS portfolio_snapshots;
CREATE TABLE portfolio_snapshots (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    portfolio_id        INT            NOT NULL,
    user_id             INT            NOT NULL,
    posting_id          INT            NULL     COMMENT '타겟 채용공고',

    -- 입력 데이터 스냅샷
    structured_resume   JSON           NULL     COMMENT '생성 당시 정형화된 이력서',
    skill_analysis      JSON           NULL     COMMENT 'SkillGap 분석 요약',
    problem_history     JSON           NULL     COMMENT 'SolveHistory 요약 (풀이수, 태그별 정답률, 향상추이)',

    -- 생성 결과
    generated_content   JSON           NULL     COMMENT '생성된 포트폴리오 섹션별 내용',
    generation_method   VARCHAR(20)    NOT NULL DEFAULT 'gemini'
                                               COMMENT 'gemini / model_v1 / model_v2 / manual',
    generation_prompt   TEXT           NULL     COMMENT '재현 및 개선용 프롬프트 보존',
    model_version       VARCHAR(50)    NULL,

    -- 버전 관리
    version             SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    is_final            TINYINT(1)     NOT NULL DEFAULT 0 COMMENT '현재 최종 버전',
    quality_score       FLOAT          NULL     COMMENT '자동 품질 평가 점수 (0~100)',

    generated_at        DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                               ON UPDATE CURRENT_TIMESTAMP(6),

    INDEX idx_ps_user_final    (user_id, is_final),
    INDEX idx_ps_version       (portfolio_id, version),
    INDEX idx_ps_method        (generation_method),
    INDEX idx_ps_generated_at  (generated_at),
    CONSTRAINT fk_ps_portfolio FOREIGN KEY (portfolio_id) REFERENCES core_portfolio(id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_user      FOREIGN KEY (user_id)      REFERENCES core_user(id)      ON DELETE CASCADE,
    CONSTRAINT fk_ps_posting   FOREIGN KEY (posting_id)   REFERENCES core_jobposting(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='포트폴리오 생성 버전 이력 (Gemini → 자체모델 전환 추적)';

-- ────────────────────────────────────────
-- 4. portfolio_feedback  (RLHF 피드백)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS portfolio_feedback;
CREATE TABLE portfolio_feedback (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    snapshot_id         BIGINT UNSIGNED NOT NULL,
    user_id             INT             NOT NULL,

    -- 피드백 내용
    rating              TINYINT         NOT NULL COMMENT '1~5점',
    feedback_text       TEXT            NULL,
    edited_content      JSON            NULL     COMMENT '사용자가 수정한 내용 (원본 비교용)',

    -- RLHF 레이블
    -- 예) {"overall":4, "relevance":3, "completeness":5,
    --       "preferred_sections":["skills","projects"],
    --       "rejected_sections":["summary"],
    --       "edit_distance":0.12}
    rlhf_labels         JSON            NULL,

    -- 학습 사용 추적
    used_for_training   TINYINT(1)      NOT NULL DEFAULT 0,
    training_batch_id   VARCHAR(100)    NULL     COMMENT '어느 학습 배치에 포함됐는지',

    created_at          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE KEY uq_pf_snapshot_user (snapshot_id, user_id),
    INDEX idx_pf_training    (used_for_training),
    INDEX idx_pf_rating      (rating),
    INDEX idx_pf_created_at  (created_at),
    CONSTRAINT fk_pf_snapshot FOREIGN KEY (snapshot_id) REFERENCES portfolio_snapshots(id) ON DELETE CASCADE,
    CONSTRAINT fk_pf_user     FOREIGN KEY (user_id)     REFERENCES core_user(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='RLHF 피드백 — 포트폴리오 생성 모델 개선용 학습 데이터';

SET FOREIGN_KEY_CHECKS = 1;

-- ────────────────────────────────────────
-- 적용 확인 쿼리
-- ────────────────────────────────────────
SELECT
    table_name,
    table_comment,
    table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
      'skill_gaps',
      'problem_recommendations',
      'portfolio_snapshots',
      'portfolio_feedback'
  )
ORDER BY table_name;