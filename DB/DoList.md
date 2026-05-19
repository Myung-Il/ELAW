# DBA 관점 DoList

> 작성일: 2026-05-19

---

## 진행된 것 (설계/코드 완성)

### 스키마 설계 완료 (21개 테이블, 4개 레이어)

| 레이어 | 파일 | 테이블 수 |
|--------|------|-----------|
| 기본 사용자·인증·학습 | `backend/core/models.py` + `DB/sql/1_schema_base.sql` | 12개 |
| HuggingFace 데이터셋 | `DB/sql/02_schema_dataset.sql` | 5개 |
| 갭분석·추천·RLHF | `DB/sql/03_schema_new.sql` | 4개 |
| 문제 데이터셋·그래프 | `DB/sql/04_schema_problems.sql` | 5개 |

### 잘 된 설계 부분

- 복합 인덱스 전략이 쿼리 패턴에 맞게 정의됨 (`idx_solve_user_solved_at`, `idx_matches_user_score` 등)
- UNIQUE 제약으로 중복 방지 (`user+platform`, `user+platform+problem_id` 등)
- `ON DELETE CASCADE / SET NULL / RESTRICT` 혼합 전략으로 참조 무결성 설계
- `utf8mb4_unicode_ci` 인코딩 (이모지·한글 지원)
- AI 호출 추적 테이블(`core_ailog`) 존재
- RLHF 피드백 루프 스키마 설계 완료 (`portfolio_snapshots`, `portfolio_feedback`)

---

## 진행해야 할 것 (미완료)

### P0 — 즉시 필요 (운영 불가 상태)

#### 1. Django 마이그레이션 미적용

- `db.sqlite3` 파일이 없음 → DB가 아예 존재하지 않는 상태
- `DB/migrations/` 디렉토리도 없음

```bash
cd backend
python manage.py makemigrations core accounts board jobs
python manage.py migrate
```

#### 2. `DB/core/models_new.py`와 `models_problems.py`가 Django에 미등록

- `DB/sql/` SQL 파일과 `DB/core/` 모델 파일들이 `backend` Django 앱에 통합되지 않음
- `models_register.py`가 존재하지만 Django `INSTALLED_APPS` 연결 여부 불명확
- 신규 모델들이 실제 migrate 대상에 포함되어 있는지 확인 필요
- 미통합 시 21개 중 9개 테이블 누락 가능

---

### P1 — 개발 완성을 위해 필요

#### 3. MySQL 전환 미완료

- `settings.py`에 MySQL 설정이 주석 처리된 상태 (SQLite만 활성화)
- `docker-compose.yml`에 MySQL 컨테이너 없음 (backend 컨테이너만 존재)
- SQLite는 동시성 없음 → 프로덕션 환경 불가

`docker-compose.yml`에 추가 필요:

```yaml
mysql:
  image: mysql:8.0
  environment:
    MYSQL_DATABASE: elaw_db
    MYSQL_USER: elaw_user
    MYSQL_PASSWORD: ${DB_PASSWORD}
  ports: ["3306:3306"]
  volumes:
    - mysql_data:/var/lib/mysql
```

#### 4. DB 볼륨 마운트 미설정

- 현재 `docker-compose.yml`에 DB 볼륨 없음
- 컨테이너 재시작 시 데이터 소실 위험

```yaml
volumes:
  mysql_data:
```

#### 5. `settings.py` MySQL 설정 활성화

`.env` 파일 설정:

```env
DB_NAME=elaw_db
DB_USER=elaw_user
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=3306
```

`settings.py`에서 주석 해제 후 MySQL 설정 활성화, `mysqlclient` 패키지 설치:

```bash
pip install mysqlclient
```

MySQL DB 생성:

```sql
CREATE DATABASE elaw_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'elaw_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON elaw_db.* TO 'elaw_user'@'localhost';
```

---

### P2 — 기능 동작을 위해 필요

#### 6. 데이터 적재 미실행

- HuggingFace 데이터셋 2,640행 미적재
- 30개 직군 × 200문제 = 6,000개 문제 미적재
- FK 의존성 때문에 적재 순서 준수 필수

```bash
# Step 1: 마이그레이션
python manage.py migrate

# Step 2: HuggingFace 데이터셋
python manage.py load_dataset

# Step 3: 문제 데이터셋
python manage.py load_problems \
  --problems_dir /path/to/JobProblems \
  --paths_dir /path/to/LearningPaths

# Step 4: 기초 데이터 (기업/공고/게시글)
python manage.py fill_tables
```

---

### P3 — 운영 안정성

#### 7. 파티셔닝 전략 미구현

- `core_solvehistory`는 1년 운영 시 100만 행 이상 예상
- MySQL 전환 후 연도별 파티셔닝 검토 필요

```sql
PARTITION BY RANGE(YEAR(solved_at)) (
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027)
);
```

#### 8. 추가 인덱스 검토

```sql
CREATE INDEX idx_solve_user_platform ON core_solvehistory(user_id, platform);
CREATE INDEX idx_job_problems_role_difficulty ON job_problems(job_role, difficulty);
CREATE INDEX idx_matching_status_score ON core_match(status, match_score DESC);
```

#### 9. Slow Query 모니터링 미설정

- Django `LOGGING` 설정에 DB 쿼리 로그 없음
- MySQL slow query log 활성화 검토

#### 10. 백업 정책 없음

- 일일 증분 백업 + 주간 전체 백업 정책 수립 필요

---

## 우선순위 요약

| 우선순위 | 작업 | 영향 |
|----------|------|------|
| **P0** | `makemigrations` + `migrate` 실행 | DB 자체가 없음 |
| **P0** | `models_new.py`, `models_problems.py` Django 앱에 통합 확인 | 21개 중 9개 테이블 누락 가능 |
| **P1** | docker-compose에 MySQL + 볼륨 추가 | 프로덕션 환경 불가 |
| **P1** | `settings.py` MySQL 설정 활성화 | SQLite는 동시성 없음 |
| **P2** | 데이터 적재 배치 실행 | AI 기능 동작 불가 |
| **P3** | 파티셔닝 / 백업 정책 | 운영 안정성 |
