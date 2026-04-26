"""
ELAW 백엔드 Django 설정 파일
- DB 팀이 test_db 폴더의 스키마를 만들고 DB 정보를 .env에 등록하면 바로 연동됩니다
"""

from pathlib import Path
import os
from datetime import timedelta

# 환경변수 로드 (python-dotenv 사용)
# pip install python-dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── 보안 설정 ───────────────────────────────────────────────────────────
# [BE 수정] .env 파일에 DJANGO_SECRET_KEY 설정 필요
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key-change-in-production")

# [BE 수정] 배포 시 False로 변경
DEBUG = os.environ.get("DEBUG", "True") == "True"

# [BE 수정] 배포 시 허용 호스트 설정
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ─── 앱 정의 ─────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 서드파티 앱
    "rest_framework",                    # Django REST Framework
    "rest_framework_simplejwt",          # JWT 인증
    "corsheaders",                       # CORS 허용
    # ELAW 앱
    "apps.auth_",                        # 인증 (auth는 Django 내장명과 충돌하므로 auth_ 사용)
    "apps.users",                        # 사용자
    "apps.companies",                    # 기업
    "apps.curriculum",                   # 커리큘럼
    "apps.study",                        # 공부 목록
    "apps.board",                        # 게시판
    "apps.portfolio",                    # 포트폴리오
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # CORS 미들웨어는 맨 위에 위치해야 함
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# ─── 데이터베이스 설정 ────────────────────────────────────────────────────
# [DB 팀 수정] .env 파일에 아래 환경변수를 설정해주세요:
# DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "NAME": os.environ.get("DB_NAME", "elaw_db"),
        "USER": os.environ.get("DB_USER", "elaw_user"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
    }
}

# ─── JWT 인증 설정 ────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),    # 액세스 토큰 만료: 1시간
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),    # 리프레시 토큰 만료: 7일
    "ROTATE_REFRESH_TOKENS": True,
}

# ─── CORS 설정 ────────────────────────────────────────────────────────────
# [BE 수정] 프론트엔드 주소를 허용 목록에 추가
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",    # Next.js 개발 서버
    "http://127.0.0.1:3000",
]

# ─── 국제화 설정 ──────────────────────────────────────────────────────────
LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_I18N = True
USE_TZ = True

# ─── 정적 파일 및 미디어 ──────────────────────────────────────────────────
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"