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

### 2-5. 문제 데이터 적재 (최초 1회)

`seed_all`은 사용자·공고·학습 이력만 생성하며, **실제 문제 데이터(직군별 문제·학습 경로)는 포함하지 않습니다.**
이 단계를 건너뛰면 "공부 목록 → 전체 문제 보기"와 AI 진단 퀴즈에 문제가 표시되지 않습니다.

```bash
python manage.py load_problems --problems_dir ../DB/JobProblems --paths_dir ../DB/LearningPaths
```

> - 반드시 `backend/` 디렉터리에서 실행합니다 (경로 `../DB/...`가 프로젝트 루트의 `DB` 폴더를 가리킵니다).
> - **수 분이 소요됩니다.** 6,000문제 + 학습 경로 30개를 적재하므로 중간에 멈추지 말고 기다리세요.
> - 적재 중 `[경고] 문제 없음: ... Q...→Q...` 메시지가 일부 출력되는 것은 정상입니다 (학습 경로 그래프의 일부 참조가 누락된 것으로, 기능에 영향 없음).
> - 완료 후 아래와 같은 요약이 출력되면 정상입니다.
>   ```
>   [완료] 적재 완료
>      JobProblem        : 6000개
>      JobProblemCluster : 5000개 이상
>      ProblemEdge       : 15000개 이상
>      LearningPathMeta  : 30개
>   ```

### 2-6. 기업공고 데이터 적재 (선택 — 실제 채용 데이터 노출)

`seed_all`은 카카오·네이버·라인 형태의 샘플 공고 26건만 생성합니다.
HuggingFace 데이터셋(`recuse/synthetic_resume_jd_raw_dataset`)의 **실제 직무·회사명**을 기업공고 화면에 노출하려면 아래를 실행합니다.

```bash
python manage.py load_dataset --postings
```

> - 데이터셋을 다운로드해 `DatasetEntry`로 적재한 뒤, 직무·경력·회사명을 파싱해 **기업공고(JobPosting)** 로 변환합니다.
> - 생성 결과: 11개 기업(Google·Meta·Amazon·Apple·Tesla·OpenAI 등) × 30개 직무 × 4개 경력 = **약 1,320건 공고**.
> - **수 분이 소요됩니다** (전체 2,640행 적재). 처음 한 번만 받으면 이후 캐시되어 빠릅니다.
> - 인터넷 연결이 필요합니다. HF 토큰 관련 경고(`unauthenticated requests`)는 무시해도 됩니다.
> - 다시 실행해 깨끗이 갈아끼우려면: `python manage.py load_dataset --skip-load --postings --reset-postings`
>   (`--skip-load`는 다운로드를 건너뛰고 기존 적재분으로 공고만 재생성합니다.)

> **중요 — 모든 데이터 적재는 서버를 켜기 전에 하세요.**
> SQLite는 동시 쓰기를 허용하지 않습니다. 백엔드 서버(`runserver`)가 실행 중인 상태에서 `seed_all`·`load_problems`·`load_dataset`을 실행하면
> `database is locked` 오류가 발생합니다. **migrate → seed_all → load_problems → load_dataset 을 모두 끝낸 뒤 2-7 단계에서 서버를 시작하세요.**
> (이미 서버를 켠 상태라면 서버를 종료한 후 적재하고, 적재 완료 후 다시 시작하면 됩니다.)

### 2-7. 백엔드 서버 시작

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
| 백엔드 API 연결 안 됨 (CORS) | 백엔드 서버 미기동 | 2단계 2-7 확인 |
| `database is locked` | 서버 실행 중 데이터 적재 시도 (SQLite 잠금) | 서버 종료 후 `seed_all`·`load_problems`·`load_dataset` 실행, 완료 후 서버 재시작 |
| 문제 목록·진단 퀴즈가 비어 있음 | 문제 데이터 미적재 | 2단계 2-5 `load_problems` 실행 |
| 기업공고가 샘플(카카오/네이버/라인)만 보임 | 데이터셋 미적재 | 2단계 2-6 `load_dataset --postings` 실행 |
| `UnicodeEncodeError: 'cp949' codec...` | 한국어 콘솔에서 이모지 출력 (구버전) | 최신 코드로 갱신 (`load_dataset`이 출력 인코딩을 UTF-8로 자동 설정) |

---

## 요약 — 최초 실행 체크리스트

```
[ ] Python / Node.js / Git 설치 확인
[ ] git clone 완료
[ ] backend/.env 생성 및 DJANGO_SECRET_KEY 설정
[ ] pip install -r requirements.txt (루트에서)
[ ] python manage.py migrate (backend/ 에서)
[ ] python manage.py seed_all (backend/ 에서)
[ ] python manage.py load_problems --problems_dir ../DB/JobProblems --paths_dir ../DB/LearningPaths (backend/ 에서, 수 분 소요)
[ ] python manage.py load_dataset --postings (backend/ 에서, 선택 — 실제 채용 데이터, 수 분 소요)
[ ] (적재 완료 후) python manage.py runserver → http://localhost:8000 확인
[ ] npm install (frontend/ 에서)
[ ] npm run dev → http://localhost:3000 확인
[ ] 브라우저에서 로그인 테스트
```
