# ELAW Backend API 문서

> **ELAW** = 취업 연계 학습 플랫폼  
> 기술 스택: Django + DRF + JWT

---

## 📁 프로젝트 구조

```
backend/
├── accounts/       # 회원가입, 로그인, 프로필, 플랫폼 연동
├── board/          # 게시판
├── config/         # Django 설정 (urls.py)
├── core/           # 공통 모델 + DB 조회 API + 사용자 기능 API
├── jobs/           # 채용공고, 스크랩, 공부모드, 포트폴리오 (AI 연동)
├── db.sqlite3
└── manage.py
```

---

## ⚙️ 개발 환경 설정

### 요구 사항
```
Python 3.10+
Django 4.x
djangorestframework
djangorestframework-simplejwt
```

### 설치 및 실행
```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. 마이그레이션
python manage.py migrate

# 3. 서버 실행
python manage.py runserver
```

### 기본 서버 주소
```
http://localhost:8000
```

---

## 🔐 인증 방식

**JWT (JSON Web Token)** 사용

### 토큰 발급

```http
POST /api/accounts/login/
Content-Type: application/json

{
  "username": "사용자명",
  "password": "비밀번호"
}
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1Q...",
  "refresh": "eyJ0eXAiOiJKV1Q..."
}
```

### 토큰 사용 방법
모든 인증 필요 API에 헤더 추가:
```http
Authorization: Bearer {access_token}
```

### 토큰 갱신
```http
POST /api/accounts/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1Q..."
}
```

---

## 📌 API 엔드포인트 전체 목록

### 1. 👤 Accounts (계정) — `/api/accounts/`

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| POST | `/api/accounts/signup/` | 회원가입 | ❌ |
| POST | `/api/accounts/login/` | 로그인 (JWT 발급) | ❌ |
| POST | `/api/accounts/token/refresh/` | 토큰 갱신 | ❌ |
| GET | `/api/accounts/profile/` | 내 프로필 조회 | ✅ |
| PATCH | `/api/accounts/profile/` | 내 프로필 수정 | ✅ (본인만) |
| GET/POST | `/api/accounts/platform/` | 플랫폼 연동 정보 | ✅ |
| POST | `/api/accounts/platform/sync/` | 플랫폼 동기화 | ✅ |
| GET | `/api/accounts/platform/status/` | 플랫폼 연동 상태 | ✅ |

**프로필 수정 가능 필드:**
```json
{
  "name": "이름",
  "phone": "010-0000-0000",
  "ai_consent": true,
  "privacy_consent": true
}
```

---

### 2. 📋 Board (게시판) — `/api/board/`

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| GET | `/api/board/` | 게시글 목록 | ❌ |
| POST | `/api/board/` | 게시글 작성 | ✅ (staff만) |
| PUT | `/api/board/<id>/` | 게시글 수정 | ✅ (staff만) |
| DELETE | `/api/board/<id>/` | 게시글 삭제 | ✅ (staff만) |

---

### 3. 💼 Jobs (채용공고) — `/api/jobs/`

#### 3-1. 채용공고 목록 / 상세

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| GET | `/api/jobs/` | 채용공고 목록 | ❌ |
| GET | `/api/jobs/<posting_id>/` | 채용공고 상세 (조회수 +1) | ❌ |

**GET `/api/jobs/` 쿼리 파라미터:**
```
?search=검색어           # 제목/내용 검색
?ordering=created_at     # 오래된순
?ordering=-created_at    # 최신순
```

**Response 예시 (목록):**
```json
[
  {
    "id": 1,
    "title": "백엔드 개발자 (신입)",
    "company": "카카오",
    "is_scrapped": false,
    "my_match_score": null,
    "view_count": 42
  }
]
```

**Response 예시 (상세):**
```json
{
  "id": 1,
  "title": "백엔드 개발자 (신입)",
  "company": "카카오",
  "description": "채용공고 내용...",
  "is_scrapped": true,
  "is_applied": false,
  "my_match_score": 85,
  "my_match_status": "good",
  "view_count": 43
}
```

---

#### 3-2. 나의 채용공고

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| GET | `/api/jobs/my/` | 스크랩한 공고 목록 | ✅ |

---

#### 3-3. 스크랩

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| POST | `/api/jobs/<posting_id>/scrap/` | 스크랩 추가 | ✅ |
| DELETE | `/api/jobs/<posting_id>/scrap/` | 스크랩 취소 | ✅ |

---

#### 3-4. 공부 모드

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| POST | `/api/jobs/<posting_id>/study/` | 공부 시작 | ✅ |

> ⚠️ 이미 공부 중인 공고 요청 시 `409 Conflict` 반환  
> 강제 재시작: `?force=true` 파라미터 사용

```http
POST /api/jobs/<posting_id>/study/?force=true
```

---

#### 3-5. 포트폴리오 생성 (AI 연동) ⭐

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| POST | `/api/jobs/<posting_id>/apply/` | AI 포트폴리오 생성 | ✅ |

**동작 방식:**
```
1. 해당 채용공고(JD) 가져오기
2. 로컬 Ollama mybot 모델에 JD 전달
3. AI가 맞춤 포트폴리오 생성 (30~120초 소요)
4. 생성 결과 Portfolio DB 저장
5. Response 반환
```

**Response:**
```json
{
  "id": 1,
  "job_posting": 5,
  "content": "AI가 생성한 포트폴리오 내용...",
  "created_at": "2026-05-11T10:00:00Z"
}
```

> ⚠️ **주의:** Ollama `mybot` 모델이 로컬에서 실행 중이어야 합니다!  
> AI 생성은 **30~120초** 소요됩니다. 프론트에서 로딩 처리 필요!

---

#### 3-6. 포트폴리오 관리

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| GET | `/api/jobs/portfolios/` | 내 포트폴리오 목록 | ✅ |
| GET | `/api/jobs/portfolios/<portfolio_id>/` | 포트폴리오 상세 | ✅ |
| PATCH | `/api/jobs/portfolios/<portfolio_id>/` | 포트폴리오 수정 | ✅ (본인만) |
| DELETE | `/api/jobs/portfolios/<portfolio_id>/` | 포트폴리오 삭제 | ✅ (본인만) |

---

### 4. 🗄️ DB 조회 API — `/api/db/` (대시보드용)

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/db/summary/` | 전체 요약 |
| GET | `/api/db/users/` | 유저 목록 |
| GET | `/api/db/companies/` | 회사 목록 |
| GET | `/api/db/platform-links/` | 플랫폼 연동 목록 |
| GET | `/api/db/user-goals/` | 유저 목표 목록 |
| GET | `/api/db/curricula/` | 커리큘럼 목록 |
| GET | `/api/db/solve-history/` | 풀이 이력 목록 |
| GET | `/api/db/learning-stats/` | 학습 통계 목록 |
| GET | `/api/db/portfolios/` | 포트폴리오 목록 |
| GET | `/api/db/job-postings/` | 채용공고 목록 |
| GET | `/api/db/matches/` | 매칭 목록 |
| GET | `/api/db/posts/` | 게시글 목록 |
| GET | `/api/db/ai-logs/` | AI 로그 목록 |

---

### 5. ⚙️ Core API — `/api/core/`

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| GET/POST | `/api/core/goals/` | 목표 조회/설정 | ✅ |
| POST | `/api/core/matches/generate/` | 매칭 생성 | ✅ |
| GET | `/api/core/dashboard/` | 대시보드 데이터 | ✅ |

---

## ❌ 에러 코드

| 상태코드 | 의미 | 발생 상황 |
|---------|------|---------|
| 400 | Bad Request | 요청 데이터 오류 |
| 401 | Unauthorized | 토큰 없음 / 만료 |
| 403 | Forbidden | 권한 없음 (본인 아님, staff 아님) |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 이미 공부 중인 공고 |
| 500 | Server Error | 서버 오류 (Ollama 타임아웃 등) |

---

## 🤖 AI 포트폴리오 기능 (Ollama)

### Ollama 설치 및 설정
```bash
# 1. Ollama 설치 (Mac/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# 2. mybot 모델 확인
ollama list
# NAME            SIZE
# mybot:latest    1.6 GB  ← 이게 있어야 함!

# 3. 모델 실행 테스트
ollama run mybot "백엔드 개발자 JD를 보고 포트폴리오 써줘"
```

### 백엔드 연결 구조
```
프론트 → POST /api/jobs/<id>/apply/
         ↓
      Django (jobs/portfolio_ai.py)
         ↓
      subprocess로 Ollama 호출
         ↓
      mybot 모델 (로컬 실행)
         ↓
      AI 포트폴리오 생성 (30~120초)
         ↓
      Portfolio DB 저장
         ↓
      Response 반환
```

---

## 🔧 프론트엔드 연동 가이드

### JavaScript 연동 예시

```javascript
const BASE_URL = 'http://localhost:8000';

// ── 1. 회원가입 ──────────────────────────────
await fetch(`${BASE_URL}/api/accounts/signup/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'geonhwi',
    password: 'password123',
    name: '김건휘'
  })
});

// ── 2. 로그인 → 토큰 저장 ────────────────────
const res = await fetch(`${BASE_URL}/api/accounts/login/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'geonhwi', password: 'password123' })
});
const { access, refresh } = await res.json();
localStorage.setItem('access', access);

// ── 3. 인증 필요한 API 호출 ──────────────────
const token = localStorage.getItem('access');
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// ── 4. 채용공고 목록 ─────────────────────────
const jobs = await fetch(`${BASE_URL}/api/jobs/`, { headers });

// ── 5. 스크랩 추가 ───────────────────────────
await fetch(`${BASE_URL}/api/jobs/1/scrap/`, {
  method: 'POST', headers
});

// ── 6. AI 포트폴리오 생성 (30~120초!) ────────
const portfolio = await fetch(`${BASE_URL}/api/jobs/1/apply/`, {
  method: 'POST', headers
});
// ⚠️ 시간이 오래 걸리므로 로딩 스피너 필수!

// ── 7. 포트폴리오 목록 ───────────────────────
const portfolios = await fetch(`${BASE_URL}/api/jobs/portfolios/`, { headers });
```

---

## 🚀 팀 합작 체크리스트

### 프론트엔드
- [ ] 회원가입 / 로그인 → `POST /api/accounts/signup/`, `login/`
- [ ] 토큰 저장 및 갱신 처리
- [ ] 채용공고 목록 페이지 → `GET /api/jobs/`
- [ ] 채용공고 상세 페이지 → `GET /api/jobs/<posting_id>/`
- [ ] 스크랩 버튼 → `POST/DELETE /api/jobs/<posting_id>/scrap/`
- [ ] 공부 모드 버튼 → `POST /api/jobs/<posting_id>/study/`
- [ ] **AI 포트폴리오 생성 버튼 + 로딩 처리** → `POST /api/jobs/<posting_id>/apply/`
- [ ] 포트폴리오 목록 페이지 → `GET /api/jobs/portfolios/`
- [ ] 대시보드 → `GET /api/core/dashboard/`

### 백엔드
- [x] accounts API (회원가입, 로그인, 프로필, 플랫폼 연동)
- [x] board API (게시판 CRUD)
- [x] jobs API (채용공고, 스크랩, 공부모드, 포트폴리오 - 11개 엔드포인트)
- [x] AI 포트폴리오 (Ollama mybot 연동)
- [x] core API (goals, matches, dashboard)
- [x] db API (대시보드용 조회 13개)
- [ ] 서버 배포

### DB 
- [ ] 운영 DB 마이그레이션 (SQLite → 운영 DB)
- [ ] 초기 채용공고 더미 데이터 삽입
- [ ] DB 서버 설정

---

## ⚠️ 프론트 연동 주의사항

```
1. AI 포트폴리오 생성은 30~120초 소요
   → 반드시 로딩 스피너 처리!

2. 공부 모드 409 Conflict 처리
   → "이미 공부 중입니다. 재시작할까요?" 팝업
   → 재시작: ?force=true 파라미터 추가

3. 토큰 만료 시 자동 갱신
   → 401 응답 받으면 /api/accounts/token/refresh/ 호출
   → 새 access 토큰으로 재요청

4. portfolios URL 주의
   → /api/jobs/portfolios/ (정상)
   → /api/jobs/<id>/portfolios/ (X - 잘못된 URL)
```

---

## 📝 로컬 테스트

```bash
# 서버 실행
cd backend
python manage.py runserver

# API 테스트 (VS Code REST Client 확장 필요)
# test_my_apis.http 파일 열어서 테스트
```



*Last updated: 2026-05-19*
