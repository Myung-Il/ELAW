# ELAW 실행 가이드

GitHub에서 클론 후 로컬 환경에서 웹 서비스를 실행하는 단계별 절차입니다.

---

## 사전 요구사항

| 도구 | 권장 버전 | 확인 명령 |
|------|-----------|-----------|
| Python | 3.11 이상 | `python --version` |
| Node.js | 18 LTS 이상 | `node --version` |
| npm | 9 이상 | `npm --version` |
| Git | 최신 | `git --version` |

---

## 1단계 — 저장소 클론

```bash
git clone https://github.com/Ohseonghwan538/ELAW.git
cd ELAW
```

---

## 2단계 — 백엔드 설정

### 2-1. 환경변수 파일 생성

```bash
cd backend
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

`.env` 파일을 텍스트 편집기로 열어 아래 값을 설정합니다.

```env
# 필수 — 임의의 긴 문자열로 교체하세요
DJANGO_SECRET_KEY=your-secret-key-change-this

DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# 선택 — AI 기능 사용 시 발급 후 입력
GEMINI_API_KEY=
GITHUB_TOKEN=
```

> `DJANGO_SECRET_KEY`는 반드시 설정해야 서버가 기동됩니다.
> 임의 문자열 예시: `python -c "import secrets; print(secrets.token_hex(32))"`

### 2-2. Python 의존성 설치

프로젝트 루트의 `requirements.txt`를 사용합니다 (backend 디렉터리가 아닌 루트).

```bash
cd ..              # 프로젝트 루트로 이동
pip install -r requirements.txt
```

### 2-3. DB 마이그레이션

```bash
cd backend
python manage.py migrate
```

### 2-4. 초기 데이터 적재 (최초 1회)

시드 데이터를 넣으면 채용공고, 사용자 계정, 학습 이력 등이 자동 생성됩니다.

```bash
python manage.py seed_all
```

> 완료 후 `[완료] 시드 데이터 생성 완료!` 메시지가 출력되면 정상입니다.

### 2-5. 백엔드 서버 시작

```bash
python manage.py runserver
```

터미널에 `Starting development server at http://127.0.0.1:8000/` 가 표시되면 정상입니다.

---

## 3단계 — 프론트엔드 설정

**새 터미널을 열어서** 아래 명령을 실행합니다.

### 3-1. Node 의존성 설치

```bash
cd ELAW/frontend    # 클론받은 루트 기준 경로
npm install
```

### 3-2. 프론트엔드 개발 서버 시작

```bash
npm run dev
```

터미널에 `Local: http://localhost:3000` 이 표시되면 정상입니다.

---

## 4단계 — 웹 브라우저에서 확인

| 서비스 | URL |
|--------|-----|
| **프론트엔드 (메인 서비스)** | http://localhost:3000 |
| 백엔드 API 루트 | http://localhost:8000 |
| Django 관리자 페이지 | http://localhost:8000/admin/ |

브라우저에서 `http://localhost:3000` 을 열면 ELAW 랜딩 페이지가 표시됩니다.

---

## 테스트 계정 (seed_all 실행 후 사용 가능)

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| `seonghwan.oh@elaw.kr` | `elaw1234!` | 학생 (실제 사용자) |
| `test@elaw.kr` | `test1234` | 학생 |
| `admin1@elaw.kr` | `elaw1234!` | 관리자 |

---

## 선택 — AI 기능 활성화

### Gemini (커리큘럼 자동 생성)

1. Google AI Studio에서 API 키 발급
2. `backend/.env`의 `GEMINI_API_KEY=` 뒤에 키 입력
3. 백엔드 서버 재시작

> 키가 없으면 8주 기본 커리큘럼으로 폴백됩니다.

### Ollama (AI 포트폴리오 생성)

포트폴리오 생성(`/jobs/[id]/apply`) 기능은 로컬 Ollama가 필요합니다.

```bash
# Ollama 설치 후 (https://ollama.com)
ollama run mybot   # 첫 실행 시 모델 다운로드 (수 분 소요)
```

> Ollama가 없으면 포트폴리오 생성 요청 시 해당 엔드포인트만 실패합니다.

---

## 자주 발생하는 오류

| 오류 | 원인 | 해결 |
|------|------|------|
| `DJANGO_SECRET_KEY 환경변수가 설정되지 않았습니다` | `.env` 파일 없음 또는 키 미설정 | `backend/.env`에 `DJANGO_SECRET_KEY` 설정 |
| `No module named 'rest_framework'` | 의존성 미설치 | `pip install -r requirements.txt` 재실행 |
| `Error: Cannot find module 'next'` | npm 패키지 미설치 | `frontend/` 에서 `npm install` 실행 |
| 포트 충돌 (`port already in use`) | 이미 실행 중인 서버 | 기존 프로세스 종료 후 재시작 |
| 백엔드 API 연결 안 됨 (CORS) | 백엔드 서버 미기동 | 2단계 2-5 확인 |

---

## 요약 — 최초 실행 체크리스트

```
[ ] Python / Node.js / Git 설치 확인
[ ] git clone 완료
[ ] backend/.env 생성 및 DJANGO_SECRET_KEY 설정
[ ] pip install -r requirements.txt (루트에서)
[ ] python manage.py migrate (backend/ 에서)
[ ] python manage.py seed_all (backend/ 에서)
[ ] python manage.py runserver → http://localhost:8000 확인
[ ] npm install (frontend/ 에서)
[ ] npm run dev → http://localhost:3000 확인
[ ] 브라우저에서 로그인 테스트
```
