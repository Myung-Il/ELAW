# ELAW - 공과대학 학습지원 / 취업연계 플랫폼

## 프로젝트 구조

```
project/
├── frontend/          ← 프론트엔드 팀 (Next.js)
│   ├── app/          ← 페이지 (로그인, 홈, 기업공고, 커리큘럼, 게시판, 프로필 등)
│   ├── components/   ← 공통 UI 컴포넌트
│   ├── hooks/        ← React 커스텀 훅
│   ├── lib/          ← 유틸리티 함수
│   ├── public/       ← 정적 파일 (이미지, 아이콘)
│   ├── package.json  ← npm 의존성
│   └── README.md     ← FE 팀 가이드
│
├── test_be/           ← 백엔드 팀 (Django REST Framework)
│   ├── apps/         ← API 앱 (auth, users, companies, curriculum, study, board, portfolio)
│   ├── config/       ← Django 설정 (settings.py, urls.py)
│   ├── manage.py
│   ├── requirements.txt
│   └── README.md     ← BE 팀 가이드
│
└── test_db/           ← DB 팀 (PostgreSQL)
    ├── schemas/      ← 테이블 DDL SQL
    ├── seeds/        ← 초기 데이터 SQL
    ├── migrations/   ← 마이그레이션 스크립트
    └── README.md     ← DB 팀 가이드
```

## 각 팀 작업 방법

### FE 팀 (frontend/)
```bash
cd frontend
npm install
# components/ui 폴더를 루트 project/components/ui에서 복사
npm run dev   # localhost:3000
```

### BE 팀 (test_be/)
```bash
cd test_be
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # DB 정보 입력
python manage.py runserver 8000   # localhost:8000
```

### DB 팀 (test_db/)
```bash
# PostgreSQL 실행 후
psql -h localhost -U elaw_user -d elaw_db -f test_db/schemas/create_tables.sql
```

## 서비스 플로우

```
사용자 진입
  │
  ▼
/ (랜딩 페이지)
  ├─ 로그인 클릭 → /login
  │     ├─ 최초 로그인 → /goal-setting (목표 설정)
  │     │                      ↓
  │     └─ 기존 로그인 → /home (메인 페이지)
  └─ 회원가입 클릭 → /register → /login

/home (로그인 후 메인)
  ├─ 기업공고 → /jobs → /jobs/[id] → /jobs/[id]/apply
  ├─ 커리큘럼 → /curriculum
  ├─ 공부목록 → /study
  ├─ 게시판  → /board → /board/[id]
  └─ 프로필  → /profile
```

## 팀별 담당 범위

| 팀 | 폴더 | 담당 |
|----|------|------|
| FE | `frontend/` | UI/UX, 페이지 구현, API 연동 |
| BE | `test_be/` | REST API, 비즈니스 로직, 인증 |
| DB | `test_db/` | 테이블 설계, 마이그레이션, 최적화 |

## 개발 규칙

### 코드 주석
- `[FE 수정 매뉴얼]` - FE 팀이 수정해야 할 부분
- `[BE 매뉴얼]` - BE 팀이 구현해야 할 API
- `[DB 매뉴얼]` - DB 팀이 설계해야 할 테이블/쿼리
- `TODO:` - 실제 구현으로 교체 필요한 임시 코드

### Git 브랜치 전략
- `main` - 배포 브랜치 (보호됨)
- `develop` - 통합 개발 브랜치
- `fe/기능명` - FE 팀 기능 브랜치
- `be/기능명` - BE 팀 기능 브랜치
- `db/기능명` - DB 팀 기능 브랜치