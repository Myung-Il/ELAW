"""
config/urls.py
"""

from django.contrib import admin
from django.urls import path, include

from core.views_db import (
    DBUserView, DBCompanyView, DBPlatformLinkView, DBUserGoalView,
    DBCurriculumView, DBSolveHistoryView, DBLearningStatsView,
    DBPortfolioView, DBJobPostingView, DBMatchView, DBPostView,
    DBAiLogView, DBSummaryView,
)
from core.views_user import GoalView, MatchGenerateView, DashboardView
from core.views_solve import (
    JobProblemListView, SolveProblemView,
    RecommendationView, SkillGapView,
    PortfolioGenerateView, PortfolioFeedbackView,
)

# DB 조회 API (대시보드용)
db_urls = [
    path('summary/',        DBSummaryView.as_view()),
    path('users/',          DBUserView.as_view()),
    path('companies/',      DBCompanyView.as_view()),
    path('platform-links/', DBPlatformLinkView.as_view()),
    path('user-goals/',     DBUserGoalView.as_view()),
    path('curricula/',      DBCurriculumView.as_view()),
    path('solve-history/',  DBSolveHistoryView.as_view()),
    path('learning-stats/', DBLearningStatsView.as_view()),
    path('portfolios/',     DBPortfolioView.as_view()),
    path('job-postings/',   DBJobPostingView.as_view()),
    path('matches/',        DBMatchView.as_view()),
    path('posts/',          DBPostView.as_view()),
    path('ai-logs/',        DBAiLogView.as_view()),
]

# 사용자 기능 API
core_urls = [
    path('goals/',                               GoalView.as_view()),
    path('matches/generate/',                    MatchGenerateView.as_view()),
    path('dashboard/',                           DashboardView.as_view()),
    path('problems/',                            JobProblemListView.as_view()),
    path('problems/<int:problem_id>/solve/',     SolveProblemView.as_view()),
    path('recommendations/',                     RecommendationView.as_view()),
    path('skill-gaps/',                          SkillGapView.as_view()),
    path('portfolio/generate/',                  PortfolioGenerateView.as_view()),
    path('portfolio/feedback/',                  PortfolioFeedbackView.as_view()),
]

urlpatterns = [
    path('admin/',        admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/board/',    include('board.urls')),    # ⭐ 새로 추가!
    path('api/db/',       include((db_urls,   'db'))),
    path('api/core/',     include((core_urls, 'core'))),
]