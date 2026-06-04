# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행

```bash
# 의존성 설치
pip install -r ../requirements.txt

# DB 마이그레이션 & 서버 실행
python manage.py migrate
python manage.py runserver          # localhost:8000 (로컬)
# Docker 환경에서는 0.0.0.0:9000

# 초기 데이터 적재
python manage.py seed_all
python manage.py sync_platforms
```

## 앱 구조

| 앱 | 역할 |
|----|------|
| `core` | 커스텀 User 모델, 학습 목표, 풀이 이력, 통계, 매칭, 대시보드, ETL |
| `accounts` | JWT 인증, 플랫폼 연동 (Baekjoon/GitHub) |
| `jobs` | 채용공고 CRUD, 스크랩, 스터디 모드, AI 포트폴리오 생성 |
| `board` | 공지·이벤트 게시판 (관리자 전용 작성) |
| `config` | Django settings, root URLconf |

## API 엔드포인트

### `/api/accounts/`
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/signup/` | ❌ | 회원가입 |
| POST | `/login/` | ❌ | JWT 토큰 발급 |
| POST | `/token/refresh/` | ❌ | 액세스 토큰 갱신 |
| GET/PATCH | `/profile/` | ✅ | 프로필 조회·수정 (name, phone, consents만 수정 가능) |
| GET/POST | `/platform/` | ✅ | 플랫폼 연동 조회·등록 |
| POST | `/platform/sync/` | ✅ | ETL 트리거 (solved.ac / GitHub) |
| GET | `/platform/status/` | ✅ | 동기화 상태 + 언어 통계 + 취약 태그 |

### `/api/jobs/`
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/` | ❌ | 공고 목록 (`q`, `company`, `job_role`, `career_level`, `active_only`, `sort`) |
| GET | `/<id>/` | ❌ | 공고 상세 (view_count +1) |
| GET | `/my/` | ✅ | 내 스크랩·지원 목록 (`status=scrapped/applied/all`) |
| POST/DELETE | `/<id>/scrap/` | ✅ | 스크랩 추가·제거 |
| POST | `/<id>/study/` | ✅ | 스터디 목표 생성 (이미 있으면 409, `?force=true`로 재생성) |
| POST | `/<id>/apply/` | ✅ | **AI 포트폴리오 생성** (Ollama, 30~120초) |
| GET | `/portfolios/` | ✅ | 내 포트폴리오 목록 |
| GET/PATCH/DELETE | `/portfolios/<id>/` | ✅ | 포트폴리오 상세·수정·삭제 |

### `/api/board/`
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/` | ❌ | 게시글 목록 (category 필터) |
| POST | `/` | ✅ Staff | 게시글 작성 |
| GET | `/<id>/` | ❌ | 게시글 상세 (view_count +1) |
| PUT/DELETE | `/<id>/` | ✅ Staff | 수정·삭제 |

### `/api/core/`
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET/POST | `/goals/` | ✅ | 목표 조회·생성 (기업공고 기반 커리큘럼 자동 생성, `use_ai=true` 시 Gemini) |
| POST | `/matches/generate/` | ✅ | 전체 공고 매칭 점수 재계산 |
| GET | `/dashboard/` | ✅ | 목표·통계·매칭·포트폴리오 통합 조회 |

### `/api/db/` (대시보드용 읽기 전용 13개)
`/summary/`, `/users/`, `/companies/`, `/platform-links/`, `/user-goals/`, `/curricula/`, `/solve-history/`, `/learning-stats/`, `/portfolios/`, `/job-postings/`, `/matches/`, `/posts/`, `/ai-logs/`

## 핵심 모델 관계

```
User (core.User — email 기반, AbstractBaseUser)
 ├─ Company (1:1)
 ├─ PlatformLink (N, unique: user+platform)
 ├─ UserGoal (N, is_active=True인 것 1개)
 │   └─ Curriculum (AI 생성, content_json: weeks 배열)
 ├─ SolveHistory (N, unique: user+platform+problem_id)
 ├─ LearningStats (N, unique: user+stat_type+stat_key)
 ├─ Portfolio (N)
 └─ Match (N, unique: user+posting)
        └─ JobPosting (Company FK)
```

## AI 통합 포인트

### Ollama — 포트폴리오 생성 (`jobs/portfolio_ai.py`)
```python
# POST /api/jobs/<id>/apply/ 호출 시
subprocess.run(['ollama', 'run', 'mybot', prompt])
# 전제: Ollama 설치 + mybot 모델 존재 (ollama list | grep mybot)
# 응답: 30~120초, ANSI 제어문자 제거 후 content_json에 저장
```

### 커리큘럼 생성 (`core/views_user.py`)
```python
# POST /api/core/goals/ — 기본은 기업공고 기반 (AI 호출 없음)
# posting_based_curriculum(): 직무 매칭 공고들의 required/preferred_skills를
#   빈도순 집계 → default_curriculum()으로 주차 구성
# "use_ai": true 전달 시에만 Gemini 2.0 Flash 시도 (실패 시 공고 기반 폴백)
# Gemini 호출 시 AiLog에 토큰·지연 시간 기록
```

### ETL (`core/etl/`)
- `baekjoon_collector.py`: solved.ac 공개 API → `SolveHistory` + `LearningStats`
- `github_collector.py`: GitHub REST API v3 (PAT 필요) → 언어 통계·포트폴리오 저장소

## 매칭 점수 알고리즘 (`core/views_user.py::MatchGenerateView`)

```
req_score  = (겹치는 required skills / 전체) × 60
pref_score = (겹치는 preferred skills / 전체) × 25
algo_bonus = min(algo_count × 1.5, 15)
total      = min(req_score + pref_score + algo_bonus, 100)

점수 → status: ≥80 applied / ≥65 scrapped / ≥50 viewed / else recommended
```

## 설정 및 환경변수

`config/settings.py` 기본값:
- `AUTH_USER_MODEL = 'core.User'`
- `CORS_ALLOW_ALL_ORIGINS = True` (운영 시 제한 필요)
- JWT: access 60분, refresh 14일
- DB: SQLite (개발), MySQL 설정 주석 처리됨

`.env` 필수 변수:
```
GEMINI_API_KEY=...
GITHUB_TOKEN=...        # 선택, GitHub API rate limit 향상
```

## 주요 컨벤션 및 주의사항

- **View 패턴**: `ViewSet` 아님, `APIView` 직접 상속
- **이메일 기반 인증**: `username` 필드 없음, `email`이 식별자
- **Match 상태 단방향**: `scrapped → applied` (되돌리기 불가)
- **스터디 모드 409**: 이미 활성 목표가 있을 때, `?force=true` 쿼리로 재생성
- **포트폴리오 버전**: 신규 생성 시 자동 increment, 명시적 version 파라미터 없음
- **SECRET_KEY**: 현재 settings.py에 하드코딩됨 — 운영 전 `.env`로 이동 필요
- **DEBUG = True**: 운영 배포 시 반드시 `False`로 변경
