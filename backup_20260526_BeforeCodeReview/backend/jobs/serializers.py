"""
jobs/serializers.py
공고 + 매칭(스크랩/지원) + 학습 목표 + 포트폴리오 Serializer
"""

from rest_framework import serializers
from core.models import JobPosting, Match, Company, UserGoal, Portfolio


# ─────────────────────────────────────────
# 회사 (간단 정보)
# ─────────────────────────────────────────

class CompanyBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'industry', 'logo_url']


# ─────────────────────────────────────────
# 공고 목록용
# ─────────────────────────────────────────

class JobPostingListSerializer(serializers.ModelSerializer):
    company = CompanyBriefSerializer(read_only=True)
    career_level_display = serializers.CharField(source='get_career_level_display', read_only=True)
    is_scrapped = serializers.SerializerMethodField()
    my_match_score = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = [
            'id', 'title', 'company',
            'job_role', 'career_level', 'career_level_display',
            'required_skills', 'preferred_skills',
            'deadline', 'view_count', 'is_active',
            'is_scrapped', 'my_match_score',
            'created_at',
        ]

    def get_is_scrapped(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Match.objects.filter(
            user=request.user, posting=obj,
            status__in=['scrapped', 'applied']
        ).exists()

    def get_my_match_score(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        match = Match.objects.filter(user=request.user, posting=obj).first()
        return match.match_score if match else None


# ─────────────────────────────────────────
# 공고 상세용
# ─────────────────────────────────────────

class JobPostingDetailSerializer(serializers.ModelSerializer):
    company = CompanyBriefSerializer(read_only=True)
    career_level_display = serializers.CharField(source='get_career_level_display', read_only=True)
    is_scrapped = serializers.SerializerMethodField()
    is_applied = serializers.SerializerMethodField()
    my_match_score = serializers.SerializerMethodField()
    my_match_status = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = [
            'id', 'title', 'description',
            'company',
            'required_skills', 'preferred_skills',
            'job_role', 'career_level', 'career_level_display',
            'deadline', 'view_count', 'is_active',
            'is_scrapped', 'is_applied',
            'my_match_score', 'my_match_status',
            'created_at', 'updated_at',
        ]

    def get_is_scrapped(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Match.objects.filter(
            user=request.user, posting=obj, status='scrapped'
        ).exists()

    def get_is_applied(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Match.objects.filter(
            user=request.user, posting=obj, status='applied'
        ).exists()

    def get_my_match_score(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        match = Match.objects.filter(user=request.user, posting=obj).first()
        return match.match_score if match else None

    def get_my_match_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        match = Match.objects.filter(user=request.user, posting=obj).first()
        return match.status if match else None


# ─────────────────────────────────────────
# 내 매칭 목록용
# ─────────────────────────────────────────

class MyMatchSerializer(serializers.ModelSerializer):
    posting = JobPostingListSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'posting',
            'match_score', 'status', 'status_display',
            'applied_at', 'created_at', 'updated_at',
        ]


# ─────────────────────────────────────────
# 학습 목표 (UserGoal)
# ─────────────────────────────────────────

class UserGoalSerializer(serializers.ModelSerializer):
    goal_type_display = serializers.CharField(source='get_goal_type_display', read_only=True)

    class Meta:
        model = UserGoal
        fields = [
            'id', 'goal_type', 'goal_type_display',
            'field', 'job_role',
            'start_date', 'end_date', 'mid_eval_date',
            'duration_weeks', 'is_active',
            'created_at', 'updated_at',
        ]


# ─────────────────────────────────────────
# 포트폴리오 (Portfolio) ⭐ 신규
# ─────────────────────────────────────────

class PortfolioListSerializer(serializers.ModelSerializer):
    """포트폴리오 목록용 - 간단 정보"""
    language_display = serializers.CharField(source='get_language_display', read_only=True)

    class Meta:
        model = Portfolio
        fields = [
            'id', 'title',
            'language', 'language_display',
            'version', 'is_public', 'public_slug',
            'created_at', 'updated_at',
        ]


class PortfolioDetailSerializer(serializers.ModelSerializer):
    """포트폴리오 상세 - 전체 내용"""
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Portfolio
        fields = [
            'id', 'title', 'summary_text',
            'content_json',
            'public_slug', 'pdf_path',
            'language', 'language_display',
            'version', 'is_public',
            'user_name', 'user_email',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'public_slug', 'pdf_path',
            'version', 'user_name', 'user_email',
            'created_at', 'updated_at',
        ]