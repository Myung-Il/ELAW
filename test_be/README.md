# ELAW 백엔드 (test_be)

## 팀 역할
이 폴더는 **백엔드 팀** 전용입니다.
프론트엔드(frontend/)에서 호출하는 API를 이 폴더에서 구현합니다.

## 기술 스택
- Framework: Django 4.2 + Django REST Framework
- Database: PostgreSQL (test_db 팀 담당)
- Auth: JWT (djangorestframework-simplejwt)
- Python: 3.11+

## 폴더 구조

```
test_be/
├── config/
│   ├── settings.py       ← Django 설정 (DB 연결, CORS 등)
│   ├── urls.py           ← 루트 URL 라우팅
│   ├── asgi.py
│   └── wsgi.py
├── apps/
│   ├── auth/             ← 로그인/회원가입/토큰 관련
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── users/            ← 사용자 프로필, 목표 설정
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── companies/        ← 기업 정보, 채용 공고
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── curriculum/       ← 커리큘럼 생성/조회/수정
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── study/            ← 공부 목록, 학습 진도
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── board/            ← 게시판 CRUD
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   └── portfolio/        ← 포트폴리오 저장/수정
│       ├── models.py
│       ├── views.py
│       ├── serializers.py
│       └── urls.py
├── manage.py
├── requirements.txt
└── .env.example
```

## 실행 방법

```bash
# 1. 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 2. 패키지 설치
pip install -r requirements.txt

# 3. 환경변수 설정
cp .env.example .env
# .env 파일에 DB 정보 입력

# 4. 마이그레이션
python manage.py migrate

# 5. 서버 실행
python manage.py runserver 8000
```

## API 엔드포인트 목록

### 인증 (auth/)
| Method | URL | 설명 |
|--------|-----|------|
| POST | /api/v1/auth/user/login | 사용자 로그인 |
| POST | /api/v1/auth/company/login | 기업 로그인 |
| POST | /api/v1/auth/logout | 로그아웃 |
| POST | /api/v1/auth/refresh | 토큰 갱신 |
| GET  | /api/v1/auth/me | 현재 로그인 사용자 정보 |
| POST | /api/v1/auth/send-sms-code | SMS 인증 코드 발송 |

### 사용자 (users/)
| Method | URL | 설명 |
|--------|-----|------|
| POST | /api/v1/users/register | 회원가입 |
| GET  | /api/v1/users/me | 내 정보 조회 |
| PUT  | /api/v1/users/me | 내 정보 수정 |
| PUT  | /api/v1/users/me/password | 비밀번호 변경 |
| DELETE | /api/v1/users/me | 회원 탈퇴 |
| POST | /api/v1/users/goals | 목표 설정 (최초 로그인) |
| GET  | /api/v1/users/applications | 지원 현황 조회 |
| GET  | /api/v1/users/posts | 내가 작성한 글 조회 |

### 기업 공고 (companies/)
| Method | URL | 설명 |
|--------|-----|------|
| GET  | /api/v1/jobs | 기업 공고 목록 (검색/필터) |
| GET  | /api/v1/jobs/{id} | 기업 공고 상세 |
| GET  | /api/v1/jobs/recommended | AI 추천 기업 (로그인 필요) |
| GET  | /api/v1/companies/featured | 파트너 기업 목록 |

### 커리큘럼 (curriculum/)
| Method | URL | 설명 |
|--------|-----|------|
| GET  | /api/v1/curriculum/me | 내 커리큘럼 조회 |
| PUT  | /api/v1/curriculum/me | 커리큘럼 수정 |
| POST | /api/v1/curriculum/generate | AI 커리큘럼 생성 |
| GET  | /api/v1/curriculum/comparison | 합격자 비교 데이터 |

### 공부 목록 (study/)
| Method | URL | 설명 |
|--------|-----|------|
| GET  | /api/v1/study/my-list | 내 공부 목록 |
| GET  | /api/v1/study/topics | 전체 공부 주제 목록 |
| POST | /api/v1/study/progress | 학습 진도 업데이트 |

### 게시판 (board/)
| Method | URL | 설명 |
|--------|-----|------|
| GET  | /api/v1/board | 게시글 목록 |
| GET  | /api/v1/board/{id} | 게시글 상세 |
| POST | /api/v1/board | 게시글 작성 |
| PUT  | /api/v1/board/{id} | 게시글 수정 |
| DELETE | /api/v1/board/{id} | 게시글 삭제 |
| POST | /api/v1/board/{id}/comments | 댓글 작성 |
| DELETE | /api/v1/board/comments/{id} | 댓글 삭제 |
| POST | /api/v1/board/{id}/like | 좋아요 토글 |

### 포트폴리오 (portfolio/)
| Method | URL | 설명 |
|--------|-----|------|
| POST | /api/v1/portfolio/generate | AI 포트폴리오 생성 |
| GET  | /api/v1/portfolio/{id} | 포트폴리오 조회 |
| PUT  | /api/v1/portfolio/{id} | 포트폴리오 수정 |

## 주의사항
- DB 연결 정보는 절대 코드에 하드코딩하지 말고 `.env` 파일 사용
- 모든 인증이 필요한 API는 JWT Bearer 토큰 검증 필수
- CORS 설정에서 프론트엔드 주소(localhost:3000) 허용 필요