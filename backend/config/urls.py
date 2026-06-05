"""
config/urls.py
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from core.views_db import (
    DBUserView, DBCompanyView, DBPlatformLinkView, DBUserGoalView,
    DBCurriculumView, DBSolveHistoryView, DBLearningStatsView,
    DBPortfolioView, DBJobPostingView, DBMatchView, DBPostView,
    DBAiLogView, DBSummaryView,
)
from core.views_landing import LandingView
from core.views_user import GoalView, MatchGenerateView, DashboardView, CurriculumUpdateView
from core.views_quiz import (
    QuizStartView, QuizSubmitView, QuizProgressView,
    QuizCompleteView, RecommendUpdateView,
    ProblemsView, QuizRecommendView, QuizQuestionsView,
    QuizStatsView, QuizAnswerView,
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
    # 랜딩 페이지 공개 데이터 (비로그인 — 구 supabase-js 직접 조회 대체)
    path('landing/',                      LandingView.as_view()),
    path('goals/',                        GoalView.as_view()),
    path('curriculum/<int:curriculum_id>/', CurriculumUpdateView.as_view()),
    path('matches/generate/',             MatchGenerateView.as_view()),
    path('dashboard/',                    DashboardView.as_view()),
    # 문제 목록
    path('problems/',                ProblemsView.as_view()),
    # ML 퀴즈·추천 파이프라인
    path('quiz/start/',              QuizStartView.as_view()),
    path('quiz/submit/',             QuizSubmitView.as_view()),
    path('quiz/progress/',           QuizProgressView.as_view()),
    path('quiz/complete/',           QuizCompleteView.as_view()),
    path('quiz/recommend/',          QuizRecommendView.as_view()),
    path('quiz/recommend/update/',   RecommendUpdateView.as_view()),
    path('quiz/questions/',          QuizQuestionsView.as_view()),
    path('quiz/stats/',              QuizStatsView.as_view()),
    path('quiz/answer/',             QuizAnswerView.as_view()),
]

urlpatterns = [
    path('admin/',        admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/board/',    include('board.urls')),
    path('api/jobs/',     include('jobs.urls')),
    path('api/db/',       include((db_urls,   'db'))),
    path('api/core/',     include((core_urls, 'core'))),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)