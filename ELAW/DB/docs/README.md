# ELAW DB 폴더 — DBA 담당자 관리 영역

## 전체 테이블 목록 (21개)

### 기존 테이블 (12개, Django 기본)
| 테이블 | 설명 |
|---|---|
| users | 사용자 계정 (학생/기업/관리자) |
| companies | 기업 정보 |
| platform_links | 백준/GitHub 연동 |
| user_goals | 학습 목표 |
| curricula | AI 생성 커리큘럼 |
| solve_history | 외부 플랫폼 풀이 이력 |
| learning_stats | 언어/태그별 정답률 통계 |
| portfolios | 포트폴리오 메인 |
| job_postings | 채용공고 |
| matches | 사용자-공고 매칭 |
| posts | 공지/이벤트 게시글 |
| ai_logs | Gemini API 호출 기록 |

### 데이터셋 레이어 (5개) — recuse/synthetic_resume_jd
| 테이블 | 설명 |
|---|---|
| dataset_entries | HuggingFace 원본 2,640행 |
| dataset_resumes | 이력서 구조화 (딥러닝 모델 파싱) |
| dataset_job_descriptions | 채용공고 구조화 |
| dataset_match_scores | AI 학습용 매칭 점수 (positive/negative pair) |
| dataset_load_history | 배치 적재 이력 |

### 문제 레이어 (5개) — JobProblems + LearningPaths
| 테이블 | 설명 |
|---|---|
| job_problems | 30직군 × 200문제 = 6,000개 |
| job_problem_clusters | 클러스터 (category+subcategory 묶음) |
| problem_edges | 선수과목 관계 그래프 |
| learning_path_meta | 직군별 LearningPath 메타 (30행) |
| job_problem_solve_history | 사용자 자체 문제 풀이 이력 |

### 추천 & 갭 분석 레이어 (2개)
| 테이블 | 설명 |
|---|---|
| skill_gaps | 현재 수준 vs 공고 요구 수준 차이 |
| problem_recommendations | 추천 모델 출력 결과 |

### 포트폴리오 & RLHF 레이어 (2개)
| 테이블 | 설명 |
|---|---|
| portfolio_snapshots | 포트폴리오 버전 이력 |
| portfolio_feedback | RLHF 피드백 (모델 재학습 데이터) |

---

## 데이터 흐름

```
[데이터 수집]
① HuggingFace 데이터셋
   load_dataset → dataset_entries
   딥러닝 모델 파싱 → dataset_resumes / dataset_job_descriptions
   매칭 점수 계산 → dataset_match_scores

② 자체 문제 데이터셋
   load_problems → job_problems (6,000개)
                 → job_problem_clusters + problem_edges + learning_path_meta

③ 사용자 실제 데이터
   solved.ac API → solve_history → learning_stats
   GitHub API   → portfolio.content_json

[갭 분석 & 추천]
learning_stats + job_postings → AbilityCalculator → skill_gaps
skill_gaps + problem_edges → 추천 모델 → problem_recommendations
사용자 풀이 → job_problem_solve_history → 갭 재계산

[포트폴리오 생성 & RLHF]
structured_resume + skill_analysis + problem_history
→ PortfolioBuilder.build(method='gemini') → portfolio_snapshots (v1)
→ 사용자 피드백 → portfolio_feedback
→ RLHFCollector.extract_training_batch()
→ 자체 모델 재학습 → build(method='model_v2') → portfolio_snapshots (v2)
```

---

## MySQL 전환 방법

### 1. MySQL DB & 유저 생성
```sql
CREATE DATABASE elaw_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'elaw_user'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON elaw_db.* TO 'elaw_user'@'localhost';
```

### 2. .env 파일 수정
```
DB_NAME=elaw_db
DB_USER=elaw_user
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=3306
```

### 3. settings.py 수정
```python
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
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

### 4. 패키지 설치
```bash
pip install mysqlclient
```

### 5. Migration 적용
```bash
python manage.py makemigrations --merge --no-input
python manage.py migrate
```

---

## 데이터 적재 순서

```bash
# Step 1. HuggingFace 데이터셋 원본 적재
python manage.py load_dataset

# Step 2. 문제 데이터셋 적재
python manage.py load_problems \
  --problems_dir /path/to/JobProblems \
  --paths_dir   /path/to/LearningPaths

# Step 3. 기초 데이터 (기업/공고/게시글)
python manage.py fill_tables

# Step 4. 사용자 플랫폼 연동
python manage.py sync_platforms --user=mango2410@mokpo.ac.kr

# Step 5. 갭 분석 (서버 실행 후 API로)
# POST /api/core/matches/generate/
```

---

## models.py에 신규 모델 등록

`core/models.py` 맨 아래에 아래 내용 추가:

```python
from core.models_dataset import (
    DatasetEntry, DatasetResume, DatasetJobDescription,
    DatasetMatchScore, DatasetLoadHistory
)
from core.models_new import (
    SkillGap, ProblemRecommendation,
    PortfolioSnapshot, PortfolioFeedback
)
from core.models_problems import (
    JobProblem, JobProblemCluster, ProblemEdge,
    LearningPathMeta, JobProblemSolveHistory
)
```