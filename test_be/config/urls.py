"""
ELAW 백엔드 URL 라우팅
모든 API는 /api/v1/ 접두사 사용
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django 관리자 페이지
    path("admin/", admin.site.urls),

    # API v1 엔드포인트
    path("api/v1/auth/", include("apps.auth_.urls")),
    path("api/v1/users/", include("apps.users.urls")),
    path("api/v1/jobs/", include("apps.companies.urls")),
    path("api/v1/companies/", include("apps.companies.urls")),
    path("api/v1/curriculum/", include("apps.curriculum.urls")),
    path("api/v1/study/", include("apps.study.urls")),
    path("api/v1/board/", include("apps.board.urls")),
    path("api/v1/portfolio/", include("apps.portfolio.urls")),
]
