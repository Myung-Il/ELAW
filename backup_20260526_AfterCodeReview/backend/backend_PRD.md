# Backend PRD (Product Requirements Document)

> ELAW 플랫폼 백엔드 API 서버 요구사항 정의서

---

## WHO — 이해관계자 및 담당 범위

### 주 담당팀
| 역할 | 담당 범위 |
|------|----------|
| **백엔드 팀** | Django 앱 개발·유지보수·배포 |
| **프론트엔드 팀** | API 소비자 — REST 엔드포인트 호출 |
| **DB 팀** | 스키마 변경 시 migration 파일 검토·조율 |
| **ML 팀** | Ollama 모델 제공, 추천 모델 Django 연동 |

### 사용자 유형
| 유형 | 역할 | 권한 |
|------|------|------|
| **학습자(student)** | 공고 탐색, 포트폴리오 생성, 학습 진행 | 인증 필요 API 전체 |
| **기업(company)** | 채용공고 등록·관리 | 공고 관련 API |
| **관리자(admin)** | 게시판 운영, 전체 데이터 조회 | is_staff=True |
| **비로그인** | 공고 목록·상세, 게시판 읽기 | 공개 API만 |

---

## WHAT — 요구사항 및 기능 명세

### API 엔드포인트 전체 현황

#### `/api/accounts/` — 인증·프로필
| 완료 | Method | 경로 | 설명 |
|------|--------|------|------|
| ✅ | POST | `/signup/` | 회원가입 |
| ✅ | POST | `/login/` | JWT 토큰 발급 |
| ✅ | POST | `/token/refresh/` | 액세스 토큰 갱신 |
| ✅ | GET/PATCH | `/profile/` | 프로필 조회·수정 (name, phone, consents) |
| ✅ | GET/POST | `/platform/` | 플랫폼 연동 조회·등록 |
| ✅ | POST | `/platform/sync/` | ETL 트리거 |
| ✅ | GET | `/platform/status/` | 동기화 상태 + 통계 |

#### `/api/jobs/` — 채용공고·포트폴리오
| 완료 | Method | 경로 | 설명 |
|------|--------|------|------|
| ✅ | GET | `/` | 공고 목록 (검색·필터·정렬) |
| ✅ | GET | `/<id>/` | 공고 상세 (view_count +1) |
| ✅ | GET | `/my/` | 내 스크랩·지원 목록 |
| ✅ | POST/DELETE | `/<id>/scrap/` | 스크랩 추가·제거 |
| ✅ | POST | `/<id>/study/` | 스터디 목표 생성 + Gemini 커리큘럼 |
| ✅ | POST | `/<id>/apply/` | AI 포트폴리오 생성 (Ollama, 30~120초) |
| ✅ | GET | `/portfolios/` | 내 포트폴리오 목록 |
| ✅ | GET/PATCH/DELETE | `/portfolios/<id>/` | 포트폴리오 상세·수정·삭제 |

#### `/api/board/` — 공지 게시판
| 완료 | Method | 경로 | 설명 |
|------|--------|------|------|
| ✅ | GET | `/` | 게시글 목록 |
| ✅ | POST | `/` | 게시글 작성 (staff only) |
| ✅ | GET | `/<id>/` | 게시글 상세 (view_count +1) |
| ✅ | PUT/DELETE | `/<id>/` | 수정·삭제 (staff only) |

#### `/api/core/` — 목표·매칭·대시보드
| 완료 | Method | 경로 | 설명 |
|------|--------|------|------|
| ✅ | GET/POST | `/goals/` | 목표 조회·생성 |
| ✅ | POST | `/matches/generate/` | 전체 공고 매칭 점수 계산 |
| ✅ | GET | `/dashboard/` | 통합 대시보드 데이터 |

#### `/api/db/` — 관리자용 데이터 조회 (13개)
`/summary/`, `/users/`, `/companies/`, `/platform-links/`, `/user-goals/`, `/curricula/`, `/solve-history/`, `/learning-stats/`, `/portfolios/`, `/job-postings/`, `/matches/`, `/posts/`, `/ai-logs/`

### 핵심 비즈니스 로직

**매칭 점수 알고리즘**
```
required_score  = (겹치는 required skills / 전체 required) × 60
preferred_score = (겹치는 preferred skills / 전체 preferred) × 25
algo_bonus      = min(알고리즘 스킬 수 × 1.5, 15)
match_score     = min(required + preferred + algo_bonus, 100)

점수 → 상태 매핑:
  ≥ 80  → applied
  ≥ 65  → scrapped
  ≥ 50  → viewed
  else  → recommended
```

**스터디 모드 409 처리**
- 이미 활성 목표 존재 시 `409 Conflict` 반환 + 현재 목표 정보 포함
- 프론트에서 `?force=true` 파라미터로 재생성 요청 가능

**AI 포트폴리오 생성 흐름**
```
POST /api/jobs/<id>/apply/
  ↓ JobPosting에서 JD 조합
  ↓ subprocess.run(['ollama', 'run', 'mybot', prompt])
  ↓ ANSI 제어문자 제거
  ↓ Portfolio(content_json={sections:[{type:'ai_generated'}]}) 저장
  ↓ Match.status = 'applied' 갱신
  ↓ Response 반환
```

---

## WHEN — 일정 및 현재 상태

### 완료된 항목
- [x] accounts API (회원가입, 로그인, 프로필, 플랫폼 연동)
- [x] board API (CRUD, staff 권한)
- [x] jobs API (목록·상세·스크랩·스터디·포트폴리오, 총 11개 엔드포인트)
- [x] core API (goals, matches, dashboard)
- [x] db API (대시보드용 조회 13개)
- [x] AI 포트폴리오 (Ollama mybot 연동)
- [x] Gemini 커리큘럼 생성 (폴백 포함)
- [x] ETL (solved.ac, GitHub)

### 미완료 항목 (우선순위 순)
| 우선순위 | 항목 | 비고 |
|----------|------|------|
| P0 | 서버 배포 | 운영 환경 설정 필요 |
| P0 | SECRET_KEY `.env` 이관 | 현재 settings.py에 하드코딩 |
| P0 | `DEBUG = False` 설정 | 운영 배포 전 필수 |
| P1 | CORS 도메인 제한 | 현재 `CORS_ALLOW_ALL_ORIGINS = True` |
| P1 | ML 문제 추천 API 연동 | `models/curriculum/` Django 연결 |
| P2 | 페이지네이션 구현 | 현재 전체 조회 |
| P2 | Ollama 타임아웃 처리 개선 | 현재 500 에러로 반환 |

---

## WHERE — 범위 및 시스템 경계

### 파일 위치
```
backend/
├── config/         # settings.py, urls.py
├── accounts/       # 인증·프로필·플랫폼 연동
├── core/           # 공통 모델, ETL, 목표·매칭·대시보드
│   ├── etl/        # baekjoon_collector.py, github_collector.py
│   └── management/commands/
├── jobs/           # 채용공고, 포트폴리오
│   └── portfolio_ai.py   # Ollama subprocess 래퍼
└── board/          # 게시판
```

### 외부 연동 경계
| 서비스 | 연동 방식 | 사용처 |
|--------|----------|--------|
| **Ollama (mybot)** | subprocess | 포트폴리오 생성 (`jobs/portfolio_ai.py`) |
| **Gemini 2.0 Flash** | HTTP REST | 커리큘럼 생성 (`core/views_user.py`) |
| **solved.ac API** | HTTP GET (공개) | Baekjoon 풀이 이력 ETL |
| **GitHub API v3** | HTTP + PAT | 언어 통계·저장소 정보 ETL |
| **Frontend** | CORS / REST | Next.js `localhost:3000` |

### 서버 포트
- 로컬 개발: `http://localhost:8000`
- Docker 컨테이너: `http://0.0.0.0:9000`

---

## WHY — 목적 및 비즈니스 가치

### 해결하는 문제
1. **채용-학습 단절**: 사용자가 지원하려는 공고의 요구 스킬과 현재 실력 간 갭을 자동 계산
2. **포트폴리오 작성 부담**: JD 기반 AI 포트폴리오 초안 자동 생성으로 지원 장벽 낮춤
3. **학습 방향 불명확**: Gemini 기반 개인화 커리큘럼으로 목표 공고까지의 학습 경로 제시

### 아키텍처 선택 이유
| 선택 | 이유 |
|------|------|
| Django + DRF | 팀 친숙도, ORM·인증·시리얼라이저 생산성 |
| JWT (60분/14일) | Stateless, 모바일 확장 고려, Refresh로 UX 유지 |
| ViewSet 미사용, APIView 직접 상속 | 비표준 비즈니스 로직(스터디 모드 409, AI 생성 등)에 명시적 제어 필요 |
| Ollama subprocess | 로컬 LLM 비용 절감, 외부 API 의존성 제거 |

---

## HOW — 구현 방법 및 기술 제약

### 기술 스택
- **런타임**: Python 3.13, Django 6.0.3, DRF, Simple JWT
- **DB**: SQLite (개발) / MySQL 8.0+ (운영)
- **AI**: Ollama mybot (포트폴리오), Gemini 2.0 Flash (커리큘럼)
- **인프라**: Docker (Dockerfile + docker-compose)

### 인증 흐름
```
POST /api/accounts/login/ → {access(60분), refresh(14일)}
  ↓
Authorization: Bearer {access} 헤더로 모든 인증 API 호출
  ↓
401 응답 시 → POST /api/accounts/token/refresh/ → 새 access 발급
```

### 프론트엔드 연동 주의사항
1. **AI 포트폴리오 (30~120초)**: 반드시 로딩 스피너 처리, 타임아웃 상향 필요
2. **스터디 모드 409**: "이미 학습 중" 모달 → `?force=true` 재요청 구현
3. **토큰 갱신**: 401 응답 인터셉터에서 자동 갱신 후 원래 요청 재시도
4. **포트폴리오 URL**: `/api/jobs/portfolios/` (O) — `/api/jobs/<id>/portfolios/` (X)

### 환경변수 (`.env`)
```
GEMINI_API_KEY=...
GITHUB_TOKEN=...        # 선택, rate limit 향상
SECRET_KEY=...          # 운영 전 이관 필수
```

### 에러 코드 규약
| 코드 | 상황 |
|------|------|
| 400 | 요청 데이터 유효성 오류 |
| 401 | 토큰 없음·만료 |
| 403 | 권한 부족 (본인 외 자원, staff 아님) |
| 404 | 리소스 없음 |
| 409 | 비즈니스 규칙 충돌 (이미 스터디 중) |
| 500 | Ollama 타임아웃, 외부 API 오류 |
