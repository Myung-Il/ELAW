# ELAW — 취업 연계 학습 플랫폼

> 목포대학교 융합소프트웨어학과 캡스톤 프로젝트
> 채용공고와 AI 커리큘럼을 연계해 개인 맞춤 학습 경로를 제공하는 플랫폼

---

## 주요 기능

| 기능 | 설명 |
| ---- | ---- |
| AI 커리큘럼 | Gemini 2.0 Flash로 직무 맞춤 주차별 학습 계획 생성 |
| ML 문제 추천 | GKT · SAKT · DKT 앙상블로 취약 영역 진단 및 문제 추천 |
| AI 포트폴리오 | Ollama `mybot` 모델로 채용공고 기반 포트폴리오 자동 생성 |
| 채용 매칭 | 사용자 스킬과 공고 요구사항을 비교해 매칭 점수 계산 |
| 게시판 | Q&A 작성, 댓글, 좋아요, 파일/이미지 첨부 |

---

## 기술 스택

```text
Frontend   Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui
Backend    Django 6 · Django REST Framework · JWT 인증
ML Models  GKT · SAKT · DKT (순수 Python, Django 의존 없음)
Database   SQLite (개발) / MySQL (운영)
AI         Gemini 2.0 Flash (커리큘럼) · Ollama mybot (포트폴리오)
```

---

## 사전 요구사항

| 도구 | 버전 | 확인 명령 |
| ---- | ---- | --------- |
| Python | 3.10 이상 | `python --version` |
| Node.js | 18 이상 | `node --version` |
| npm | 9 이상 | `npm --version` |
| Git | 최신 | `git --version` |

### 선택 사항

- Ollama + `mybot` 모델: AI 포트폴리오 생성 기능 사용 시
- MySQL: 운영 환경 DB 사용 시

---

## 빠른 시작

### 1. 레포지토리 클론

```bash
git clone https://github.com/<your-org>/ELAW.git
cd ELAW
```

---

### 2. 백엔드 설정

```bash
cd backend
```

#### 2-1. 가상환경 생성 및 활성화

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Mac / Linux
python -m venv .venv
source .venv/bin/activate
```

#### 2-2. 패키지 설치

```bash
pip install -r ../requirements.txt
```

#### 2-3. 환경 변수 설정

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 반드시 수정하세요:

```env
DJANGO_SECRET_KEY=여기에-랜덤-비밀키-입력   # 필수
DJANGO_DEBUG=True
GEMINI_API_KEY=                              # 선택 (커리큘럼 AI 생성)
GITHUB_TOKEN=                               # 선택 (ETL rate limit)
```

> **SECRET_KEY 빠른 생성 방법**

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

#### 2-4. DB 마이그레이션

```bash
python manage.py migrate
```

#### 2-5. 초기 데이터 적재 (선택 — 문제/공고 데이터 필요 시)

```bash
python manage.py seed_all       # 전체 초기 데이터
python manage.py load_dataset   # ML 문제 데이터셋
```

#### 2-6. 백엔드 서버 실행

```bash
python manage.py runserver
# → http://localhost:8000
```

---

### 3. 프론트엔드 설정

새 터미널을 열고:

```bash
cd ELAW/frontend
```

#### 3-1. 패키지 설치

```bash
npm install
```

#### 3-2. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

> 백엔드(8000)와 프론트엔드(3000)를 **동시에** 실행해야 합니다.

---

### 4. 접속 확인

| 서버 | 주소 |
| ---- | ---- |
| 프론트엔드 | <http://localhost:3000> |
| 백엔드 API | <http://localhost:8000> |
| Django Admin | <http://localhost:8000/admin> |

---

## 프로젝트 구조

```text
ELAW/
├── backend/                   # Django 백엔드
│   ├── accounts/              # 인증 (JWT, 회원가입/로그인)
│   ├── board/                 # 게시판 (댓글, 좋아요, 파일 첨부)
│   ├── config/                # Django 설정, URL
│   ├── core/                  # 핵심 모델, 목표, 대시보드, ML 퀴즈 파이프라인
│   ├── jobs/                  # 채용공고, 스크랩, AI 포트폴리오
│   ├── media/                 # 업로드 파일 저장 디렉터리 (Git 미추적)
│   ├── manage.py
│   └── .env.example           # 환경 변수 템플릿
│
├── frontend/                  # Next.js 프론트엔드
│   ├── app/                   # App Router 페이지
│   │   ├── home/              # 메인 대시보드
│   │   ├── jobs/              # 채용공고
│   │   ├── curriculum/        # 커리큘럼 현황
│   │   ├── study/             # 공부 목록 & ML 문제 추천
│   │   ├── board/             # 게시판
│   │   └── profile/           # 프로필
│   ├── lib/                   # API 클라이언트, 유틸리티
│   └── components/            # 공통 컴포넌트
│
├── models/                    # 독립 ML 모듈 (Django 의존 없음)
│   ├── curriculum/            # GKT · SAKT · DKT 앙상블
│   └── portfolio/             # Ollama 포트폴리오 생성
│
├── requirements.txt           # Python 패키지 목록
├── .gitignore
├── .gitattributes             # 줄바꿈 정규화 (Windows ↔ Linux)
└── README.md
```

---

## 환경 변수 상세

| 변수 | 필수 | 설명 |
| ---- | ---- | ---- |
| `DJANGO_SECRET_KEY` | ✅ | Django 암호화 키 (랜덤 50자 이상 권장) |
| `DJANGO_DEBUG` | ✅ | 개발: `True`, 운영: `False` |
| `DJANGO_ALLOWED_HOSTS` | ✅ | 허용 호스트 (쉼표 구분) |
| `GEMINI_API_KEY` | ❌ | Gemini 2.0 커리큘럼 생성용. 없으면 기본 8주 폴백 |
| `GITHUB_TOKEN` | ❌ | GitHub ETL rate limit 향상용 PAT |
| `DB_ENGINE` ~ `DB_PORT` | ❌ | MySQL 운영 DB. 미설정 시 SQLite |

---

## AI 기능 선택 설정

### Gemini (커리큘럼 자동 생성)

[Google AI Studio](https://aistudio.google.com/)에서 API 키 발급 후 `.env`에 설정.
미설정 시 기본 8주 커리큘럼으로 폴백.

### Ollama (AI 포트폴리오)

```bash
# Ollama 설치 후
ollama run mybot
```

포트폴리오 생성은 `POST /api/jobs/<id>/apply/` 호출 시 사용. 미설치 시 해당 기능만 동작 안 함.

---

## 자주 묻는 문제

**Q. 마이그레이션 오류가 발생합니다.**
A. Python 가상환경이 활성화됐는지, `.env`의 `DJANGO_SECRET_KEY`가 설정됐는지 확인하세요.

**Q. 프론트엔드에서 API 요청이 실패합니다.**
A. 백엔드 서버(`http://localhost:8000`)가 실행 중인지 확인하세요.

**Q. 문제 추천이 동작하지 않습니다.**
A. `python manage.py load_dataset`으로 ML 문제 데이터를 먼저 적재하세요.

**Q. 게시판 파일 첨부가 안 됩니다.**
A. `backend/media/` 폴더가 존재하는지 확인하세요 (`mkdir backend/media`).
