-- ============================================================
-- 02_schema_dataset.sql
-- 데이터셋 레이어 테이블 5개 (MySQL 8.0+)
-- 적용: mysql -u elaw_user -p elaw_db < 02_schema_dataset.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────
-- 1. dataset_entries (원본 2,640행)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS dataset_entries;
CREATE TABLE dataset_entries (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dataset_id    CHAR(36)     NOT NULL UNIQUE COMMENT 'HuggingFace UUID (curr_type_id)',
    curr_type_str VARCHAR(200) NOT NULL COMMENT '"Software Engineer_Junior_Google" 형태',
    job_title     VARCHAR(100) NOT NULL DEFAULT 'Software Engineer',
    career_level  VARCHAR(10)  NOT NULL DEFAULT 'unknown'
                  COMMENT 'junior / mid / senior / unknown',
    company_name  VARCHAR(100) NOT NULL,
    resume_raw    LONGTEXT     NOT NULL COMMENT '이력서 원문 텍스트',
    jd_raw        LONGTEXT     NOT NULL COMMENT '채용공고 원문 텍스트',
    is_parsed     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '딥러닝 파싱 완료 여부',
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_ds_company      (company_name),
    INDEX idx_ds_level        (career_level),
    INDEX idx_ds_job          (job_title),
    INDEX idx_ds_parsed       (is_parsed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='HuggingFace recuse/synthetic_resume_jd 원본 데이터';

-- ────────────────────────────────────────
-- 2. dataset_resumes (이력서 구조화)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS dataset_resumes;
CREATE TABLE dataset_resumes (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entry_id        BIGINT UNSIGNED NOT NULL UNIQUE,
    candidate_name  VARCHAR(100)    NULL,
    email           VARCHAR(200)    NULL,
    phone           VARCHAR(50)     NULL,
    linkedin_url    VARCHAR(300)    NULL,
    github_url      VARCHAR(300)    NULL,
    profile_summary TEXT            NULL COMMENT '프로페셔널 요약',
    -- 구조화 JSON
    -- {"languages":["Python"],"frameworks":["Django"],"databases":["MySQL"],"tools":["Docker"]}
    skills_json     JSON            NULL,
    -- [{"company":"Google","role":"Junior SE","period":"2022~","duties":["API 개발"]}]
    experience_json JSON            NULL,
    -- [{"school":"서울대","major":"컴퓨터공학","degree":"학사","period":"2018~2022"}]
    education_json  JSON            NULL,
    projects_json   JSON            NULL,
    certifications  JSON            NULL,
    -- 정규화된 스킬 태그 (매칭용) ["python","django","mysql"]
    skill_tags      JSON            NULL,
    parsed_at       DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                            ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_dsresume_name (candidate_name),
    CONSTRAINT fk_resume_entry FOREIGN KEY (entry_id)
        REFERENCES dataset_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='딥러닝 모델이 파싱한 구조화 이력서';

-- ────────────────────────────────────────
-- 3. dataset_job_descriptions (공고 구조화)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS dataset_job_descriptions;
CREATE TABLE dataset_job_descriptions (
    id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entry_id              BIGINT UNSIGNED NOT NULL UNIQUE,
    job_posting_id        INT UNSIGNED    NULL COMMENT '기존 core_jobposting 연계 (선택)',
    company_name          VARCHAR(100)    NOT NULL,
    job_title             VARCHAR(200)    NOT NULL,
    location              VARCHAR(200)    NULL,
    employment_type       VARCHAR(50)     NULL COMMENT '정규직/계약직 등',
    department            VARCHAR(100)    NULL,
    -- [{"duty":"API 개발","level":"required"}]
    responsibilities      JSON            NULL,
    -- {"required":["Python","Django"],"preferred":["Docker","Redis"]}
    qualifications        JSON            NULL,
    benefits              JSON            NULL,
    required_skill_tags   JSON            NULL COMMENT '["python","django"]',
    preferred_skill_tags  JSON            NULL,
    parsed_at             DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                  ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_dsjd_company (company_name),
    INDEX idx_dsjd_title   (job_title(50)),
    CONSTRAINT fk_jd_entry   FOREIGN KEY (entry_id)       REFERENCES dataset_entries(id)  ON DELETE CASCADE,
    CONSTRAINT fk_jd_posting FOREIGN KEY (job_posting_id) REFERENCES core_jobposting(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='딥러닝 모델이 파싱한 구조화 채용공고';

-- ────────────────────────────────────────
-- 4. dataset_match_scores (AI 학습용 매칭)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS dataset_match_scores;
CREATE TABLE dataset_match_scores (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    resume_id    BIGINT UNSIGNED NOT NULL,
    jd_id        BIGINT UNSIGNED NOT NULL,
    -- 같은 entry의 resume-JD 쌍이면 True (정답 쌍)
    is_positive  TINYINT(1)      NOT NULL COMMENT '1=positive pair, 0=negative pair',
    rule_score   FLOAT           NULL     COMMENT '키워드 매칭 기반 점수 (0~100)',
    ai_score     FLOAT           NULL     COMMENT 'AI 모델 예측 점수 (0~100)',
    final_score  FLOAT           NULL     COMMENT '가중 평균 최종 점수',
    -- {"skill_match":60,"level_match":20,"scenario_sim":15}
    score_detail JSON            NULL,
    created_at   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_dsms_resume_jd (resume_id, jd_id),
    INDEX idx_dsms_positive      (is_positive),
    INDEX idx_dsms_score         (final_score DESC),
    CONSTRAINT fk_dsms_resume FOREIGN KEY (resume_id) REFERENCES dataset_resumes(id)          ON DELETE CASCADE,
    CONSTRAINT fk_dsms_jd     FOREIGN KEY (jd_id)     REFERENCES dataset_job_descriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='이력서-공고 매칭 점수 (RLHF 모델 학습 데이터)';

-- ────────────────────────────────────────
-- 5. dataset_load_history (적재 이력)
-- ────────────────────────────────────────
DROP TABLE IF EXISTS dataset_load_history;
CREATE TABLE dataset_load_history (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dataset_name  VARCHAR(200)   NOT NULL DEFAULT 'recuse/synthetic_resume_jd_raw_dataset',
    dataset_split VARCHAR(50)    NOT NULL DEFAULT 'train',
    total_rows    INT UNSIGNED   NOT NULL DEFAULT 0,
    loaded_rows   INT UNSIGNED   NOT NULL DEFAULT 0,
    failed_rows   INT UNSIGNED   NOT NULL DEFAULT 0,
    status        VARCHAR(10)    NOT NULL DEFAULT 'running'
                  COMMENT 'running / success / failed',
    error_message TEXT           NULL,
    started_at    DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    finished_at   DATETIME(6)    NULL,
    INDEX idx_dlh_started (started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='HuggingFace 데이터셋 배치 적재 이력';

SET FOREIGN_KEY_CHECKS = 1;

-- ── 적재 확인 ──────────────────────────────
SELECT
    table_name,
    table_comment,
    table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'dataset_entries','dataset_resumes','dataset_job_descriptions',
    'dataset_match_scores','dataset_load_history'
  )
ORDER BY table_name;