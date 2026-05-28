"""
jobs/urls.py
config/urls.py 에서 path('api/jobs/', include('jobs.urls')) 로 포함됨
"""

from django.urls import path
from .views import (
    JobListView,
    JobDetailView,
    JobScrapView,
    MyJobsView,
    JobStudyView,
    JobApplyView,
    PortfolioListView,
    PortfolioDetailView,
)

urlpatterns = [
    # ────────────────────────────────────────
    # 1단계: 공고
    # ────────────────────────────────────────
    path('', JobListView.as_view(), name='job_list'),
    path('my/', MyJobsView.as_view(), name='my_jobs'),

    # ────────────────────────────────────────
    # 3단계: 포트폴리오 (먼저 정의 - URL 패턴 충돌 방지)
    # ────────────────────────────────────────
    path('portfolios/', PortfolioListView.as_view(), name='portfolio_list'),
    path('portfolios/<int:portfolio_id>/', PortfolioDetailView.as_view(), name='portfolio_detail'),

    # ────────────────────────────────────────
    # 1~3단계: 공고 ID 기반 (마지막에)
    # ────────────────────────────────────────
    path('<int:posting_id>/', JobDetailView.as_view(), name='job_detail'),
    path('<int:posting_id>/scrap/', JobScrapView.as_view(), name='job_scrap'),
    path('<int:posting_id>/study/', JobStudyView.as_view(), name='job_study'),
    path('<int:posting_id>/apply/', JobApplyView.as_view(), name='job_apply'),       # ⭐ 신규
]