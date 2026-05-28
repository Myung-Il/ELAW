"""
core/admin.py
Django 관리자 페이지에 모델 등록
"""

from django.contrib import admin
from core.models import (
    User, Company, PlatformLink, UserGoal, Curriculum,
    SolveHistory, LearningStats, Portfolio, JobPosting, Match, Post, AiLog,
)


# ─────────────────────────────────────────
# 사용자 / 인증
# ─────────────────────────────────────────

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['id', 'email', 'name', 'role', 'is_active', 'is_staff', 'created_at']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['email', 'name']
    ordering = ['-created_at']


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'industry', 'is_approved', 'created_at']
    list_filter = ['is_approved', 'industry']
    search_fields = ['name', 'industry']


@admin.register(PlatformLink)
class PlatformLinkAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'external_id', 'is_active', 'last_synced']
    list_filter = ['platform', 'is_active']
    search_fields = ['user__email', 'external_id']


# ─────────────────────────────────────────
# 학습 / AI
# ─────────────────────────────────────────

@admin.register(UserGoal)
class UserGoalAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'goal_type', 'field', 'job_role', 'is_active', 'duration_weeks']
    list_filter = ['goal_type', 'is_active']
    search_fields = ['user__email', 'job_role']


@admin.register(Curriculum)
class CurriculumAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'goal', 'version', 'is_active', 'generated_at']
    list_filter = ['is_active', 'version']


@admin.register(SolveHistory)
class SolveHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'problem_id', 'problem_title', 'status', 'solved_at']
    list_filter = ['platform', 'status', 'language']
    search_fields = ['user__email', 'problem_id', 'problem_title']


@admin.register(LearningStats)
class LearningStatsAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'stat_type', 'stat_key', 'solved_count', 'total_count', 'correct_rate']
    list_filter = ['stat_type']
    search_fields = ['user__email', 'stat_key']


# ─────────────────────────────────────────
# 포트폴리오
# ─────────────────────────────────────────

@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'language', 'version', 'is_public', 'updated_at']
    list_filter = ['language', 'is_public']
    search_fields = ['user__email', 'title']


# ─────────────────────────────────────────
# 채용
# ─────────────────────────────────────────

@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ['id', 'company', 'title', 'job_role', 'career_level', 'is_active', 'deadline']
    list_filter = ['career_level', 'is_active', 'job_role']
    search_fields = ['title', 'company__name']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'posting', 'match_score', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['user__email', 'posting__title']


# ─────────────────────────────────────────
# 게시판 / 시스템 ⭐ board 앱이 사용
# ─────────────────────────────────────────

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'category', 'title', 'author', 'is_pinned', 'view_count', 'created_at']
    list_filter = ['category', 'is_pinned']
    search_fields = ['title', 'content']
    ordering = ['-is_pinned', '-created_at']
    list_editable = ['is_pinned']  # 목록에서 바로 핀 고정 토글 가능


@admin.register(AiLog)
class AiLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'feature', 'status', 'latency_ms', 'created_at']
    list_filter = ['feature', 'status']
    search_fields = ['user__email']
    readonly_fields = ['prompt_tokens', 'output_tokens', 'latency_ms', 'error_message', 'created_at']