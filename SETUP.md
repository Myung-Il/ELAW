# ELAW 설치 및 실행 가이드

목포대학교 융합소프트웨어학과 캡스톤 프로젝트 — 취업 연계 학습 플랫폼

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [프로젝트 클론](#2-프로젝트-클론)
3. [환경변수 설정](#3-환경변수-설정)
4. [백엔드 설치 및 실행](#4-백엔드-설치-및-실행)
5. [프론트엔드 설치 및 실행](#5-프론트엔드-설치-및-실행)
6. [초기 데이터 적재](#6-초기-데이터-적재)
7. [Docker로 실행 (선택)](#7-docker로-실행-선택)
8. [AI 기능 세팅 (선택)](#8-ai-기능-세팅-선택)
9. [포트 정리](#9-포트-정리)
10. [자주 발생하는 오류](#10-자주-발생하는-오류)

---

## 1. 사전 요구사항

클론 전에 아래 도구들이 설치되어 있어야 합니다.

| 도구 | 권장 버전 | 확인 명령 |
|------|-----------|-----------|
| Python | **3.11 이상** (3.13 권장) | `python --version` |
| Node.js | **18 이상** (20 LTS 권장) | `node --version` |
| npm | 9 이상 | `npm --version` |
| Git | 최신 | `git --version` |
| Docker (선택) | 최신 | `docker --version` |
| Ollama (선택) | 최신 | `ollama --version` |

> **Windows 사용자**: Python 설치 시 "Add Python to PATH" 옵션을 반드시 체크하세요.

---

## 2. 프로젝트 클론

```bash
git clone https://github.com/<org>/ELAW.git
cd ELAW
```

클론 후 디렉토리 구조:

```
ELAW/
├── backend/        # Django 백엔드
├── frontend/       # Next.js 프론트엔드
├── models/         # ML 모델 (커리큘럼 추천 / 포트폴리오 생성)
├── DB/             # 문제 데이터 JSON / SQL 스키마
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env            ← 직접 생성 필요 (아래 섹션 참고)
```

---

## 3. 환경변수 설정

프로젝트 **루트**(`ELAW/`)에 `.env` 파일을 생성합니다.

```bash
# ELAW/.env

# ── Django 기본 설정 ────────────────────────────────────────
DJANGO_SECRET_KEY=여기에_랜덤_문자열_입력   # 필수 (아래 생성법 참고)
DJANGO_DEBUG=True                           # 개발 환경: True / 운영: False

# ── AI 기능 ─────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here     # 커리큘럼 자동 생성에 필요
GITHUB_TOKEN=your_github_token_here         # GitHub ETL 사용 시 (선택)

# ── DB — SQLite 개발 환경은 아래 설정 불필요 ────────────────
# MySQL 운영 환경에서만 아래 주석 해제
# DB_ENGINE=mysql
# DB_NAME=elaw_db
# DB_USER=elaw_user
# DB_PASSWORD=yourpassword
# DB_HOST=localhost
# DB_PORT=3306

# ── ML 문제 데이터셋 경로 (load_problems 커맨드용) ──────────
# PROBLEMS_DIR=/path/to/DB/JobProblems
# PATHS_DIR=/path/to/DB/LearningPaths
```

### SECRET_KEY 생성법

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. "Create API Key" 클릭
3. 생성된 키를 `GEMINI_API_KEY`에 입력

> Gemini API 키가 없으면 커리큘럼이 하드코딩된 기본값으로 생성됩니다. 핵심 기능은 정상 동작합니다.

---

## 4. 백엔드 설치 및 실행

### 4-1. 가상환경 생성 및 활성화

```bash
# ELAW/ 루트에서 실행
python -m venv venv
```

```bash
# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 4-2. 패키지 설치

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> `mysqlclient` 설치 오류 시: MySQL 운영 환경이 아니면 설치 불필요.  
> `datasets` 설치 오류 시 (`datasets===` 형식 오류): 아래 명령으로 직접 설치
> ```bash
> pip install datasets
> ```

### 4-3. 데이터베이스 마이그레이션

```bash
cd backend
python manage.py migrate
```

### 4-4. 관리자 계정 생성 (선택)

```bash
python manage.py createsuperuser
```

### 4-5. 개발 서버 실행

```bash
python manage.py runserver
# → http://localhost:8000
```

---

## 5. 프론트엔드 설치 및 실행

**별도 터미널**을 열어서 진행합니다.

```bash
cd ELAW/frontend
npm install
npm run dev
# → http://localhost:3000
```

### 빌드 (프로덕션)

```bash
npm run build
npm start
```

---

## 6. 초기 데이터 적재

백엔드 서버가 실행 중이 아니어도 됩니다. `backend/` 디렉토리에서 가상환경이 활성화된 상태로 실행합니다.

### 기본 데이터 (기업 / 공고 / 게시글)

```bash
cd backend
python manage.py fill_tables
```

생성 내용:
- 기업 계정 3개 (카카오, 네이버, 라인플러스)
- 채용 공고 6개
- 테스트 게시글

### 문제 데이터셋 적재 (ML 기능에 필요)

#### 방법 A — 커맨드로 직접 경로 지정

```bash
python manage.py load_problems \
    --problems_dir ../DB/JobProblems \
    --paths_dir    ../DB/LearningPaths
```

#### 방법 B — .env에 경로 설정 후 setup.sh 실행 (Linux/macOS)

```bash
# .env에 PROBLEMS_DIR, PATHS_DIR 설정 후:
chmod +x DB/setup.sh
./DB/setup.sh
```

#### HuggingFace 데이터셋 적재 (약 2,640건)

```bash
cd backend
python manage.py load_dataset
```

> 인터넷 연결 필요. 처음 실행 시 HuggingFace에서 데이터를 다운로드합니다.

### 전체 초기화 한 번에

```bash
cd backend
python manage.py seed_all
```

---

## 7. Docker로 실행 (선택)

로컬에 Python 환경을 직접 구성하지 않고 Docker로 백엔드만 실행합니다.

```bash
# ELAW/ 루트에서
docker-compose up --build
# → 백엔드: http://localhost:9000
```

> Docker 환경에서는 포트가 **9000**입니다.  
> 프론트엔드는 Docker 미지원 — 별도로 `npm run dev` 실행.

마이그레이션 및 데이터 적재 (Docker 컨테이너 내부):

```bash
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py fill_tables
```

---

## 8. AI 기능 세팅 (선택)

### 8-1. 커리큘럼 자동 생성 (Gemini)

`.env`의 `GEMINI_API_KEY` 설정만으로 동작합니다. 별도 설치 불필요.

### 8-2. AI 포트폴리오 생성 (Ollama)

`/jobs/{id}/apply` 에서 AI 포트폴리오 생성 기능을 사용하려면 Ollama가 필요합니다.

```bash
# 1. Ollama 설치: https://ollama.com
# 2. 커스텀 모델 등록
ollama create mybot -f models/portfolio/Modelfile

# 3. 모델 확인
ollama list | grep mybot
```

> Ollama 없이도 포트폴리오 생성 버튼을 제외한 모든 기능은 정상 동작합니다.

---

## 9. 포트 정리

| 서비스 | 로컬 실행 포트 | Docker 포트 |
|--------|----------------|-------------|
| 백엔드 (Django) | `8000` | `9000` |
| 프론트엔드 (Next.js) | `3000` | — |
| MySQL (운영) | `3306` | `3306` |

프론트엔드의 API 기본 주소는 `http://localhost:8000`으로 설정되어 있습니다.  
Docker를 사용하는 경우 `frontend/lib/api-client.ts`에서 포트를 `9000`으로 변경하세요.

---

## 10. 자주 발생하는 오류

### `ModuleNotFoundError: No module named 'ml'`

ML 모델 경로 문제입니다. 백엔드 서버를 `backend/` 디렉토리에서 실행했는지 확인하세요.

```bash
cd backend   # ← 반드시 이 위치에서 실행
python manage.py runserver
```

### `400 Bad Request — /api/core/quiz/progress/`

정상입니다. 퀴즈 세션이 없을 때 `{"has_session": false}` 응답을 반환합니다.

### `datasets===` 설치 오류

`requirements.txt`의 `datasets===` 항목 형식 오류입니다. 직접 설치하세요.

```bash
pip install datasets
```

### CORS 오류 (프론트엔드 → 백엔드)

개발 환경에서는 `.env`에 `DJANGO_DEBUG=True`인 경우 `CORS_ALLOW_ALL_ORIGINS = True`로 자동 설정됩니다.  
오류가 지속되면 백엔드 서버가 정상 실행 중인지 확인하세요.

### `db.sqlite3` 파일 없음

마이그레이션을 먼저 실행하세요.

```bash
cd backend
python manage.py migrate
```

### `401 Unauthorized` — 로그인이 필요한 API

브라우저 로컬스토리지에 `access_token`이 없는 경우입니다.  
`http://localhost:3000/login` 에서 로그인 후 다시 시도하세요.

---

## 빠른 시작 요약

```bash
# 1. 클론
git clone https://github.com/<org>/ELAW.git && cd ELAW

# 2. .env 파일 생성 (위 섹션 참고)

# 3. 백엔드
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py fill_tables
python manage.py runserver   # → localhost:8000

# 4. 프론트엔드 (새 터미널)
cd frontend
npm install
npm run dev   # → localhost:3000
```

---

*목포대학교 융합소프트웨어학과 캡스톤 팀 | 2026*
