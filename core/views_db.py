"""
core/views_db.py
12개 테이블 전체 조회 API — DB 대시보드용

GET /api/db/users/
GET /api/db/companies/
GET /api/db/platform-links/
GET /api/db/user-goals/
GET /api/db/curricula/
GET /api/db/solve-history/
GET /api/db/learning-stats/
GET /api/db/portfolios/
GET /api/db/job-postings/
GET /api/db/matches/
GET /api/db/posts/
GET /api/db/ai-logs/
GET /api/db/summary/   ← 전체 테이블 건수 요약
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.forms.models import model_to_dict
import json


def serialize_row(obj, exclude=None):
    """모델 인스턴스를 딕셔너리로 변환 (JSON 직렬화 가능하게)"""
    exclude = exclude or []
    data = {}
    for field in obj._meta.fields:
        if field.name in exclude:
            continue
        val = getattr(obj, field.name)
        # ForeignKey → id만
        if hasattr(val, 'pk'):
            data[field.name + '_id'] = val.pk
        elif hasattr(val, 'isoformat'):
            data[field.name] = val.isoformat()
        else:
            data[field.name] = val
    return data


class DBUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import User
        rows = []
        for u in User.objects.all().order_by('id'):
            rows.append({
                'id': u.id, 'email': u.email, 'name': u.name,
                'role': u.role, 'phone': u.phone,
                'is_active': u.is_active, 'ai_consent': u.ai_consent,
                'privacy_consent': u.privacy_consent,
                'created_at': u.created_at.isoformat() if u.created_at else None,
                'updated_at': u.updated_at.isoformat() if u.updated_at else None,
            })
        return Response(rows)


class DBCompanyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import Company
        rows = []
        for c in Company.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': c.id, 'user_id': c.user_id, 'user_email': c.user.email,
                'name': c.name, 'industry': c.industry,
                'description': c.description, 'website_url': c.website_url,
                'is_approved': c.is_approved,
                'approved_at': c.approved_at.isoformat() if c.approved_at else None,
                'created_at': c.created_at.isoformat() if c.created_at else None,
            })
        return Response(rows)


class DBPlatformLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import PlatformLink
        rows = []
        for p in PlatformLink.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': p.id, 'user_id': p.user_id, 'user_name': p.user.name,
                'platform': p.platform, 'external_id': p.external_id,
                'is_active': p.is_active,
                'last_synced': p.last_synced.isoformat() if p.last_synced else None,
                'created_at': p.created_at.isoformat() if p.created_at else None,
            })
        return Response(rows)


class DBUserGoalView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import UserGoal
        rows = []
        for g in UserGoal.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': g.id, 'user_id': g.user_id, 'user_name': g.user.name,
                'goal_type': g.goal_type, 'field': g.field, 'job_role': g.job_role,
                'duration_weeks': g.duration_weeks, 'is_active': g.is_active,
                'start_date': g.start_date.isoformat() if g.start_date else None,
                'end_date': g.end_date.isoformat() if g.end_date else None,
                'mid_eval_date': g.mid_eval_date.isoformat() if g.mid_eval_date else None,
                'created_at': g.created_at.isoformat() if g.created_at else None,
            })
        return Response(rows)


class DBCurriculumView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import Curriculum
        rows = []
        for c in Curriculum.objects.select_related('user', 'goal').all().order_by('id'):
            rows.append({
                'id': c.id, 'user_id': c.user_id, 'user_name': c.user.name,
                'goal_id': c.goal_id,
                'version': c.version, 'is_active': c.is_active,
                'content_json': c.content_json,   # JSON 셀로 표시
                'created_at': c.created_at.isoformat() if c.created_at else None,
            })
        return Response(rows)


class DBSolveHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import SolveHistory
        rows = []
        for s in SolveHistory.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': s.id, 'user_id': s.user_id, 'user_name': s.user.name,
                'platform': s.platform, 'problem_id': s.problem_id,
                'problem_title': s.problem_title, 'status': s.status,
                'language': s.language, 'algo_tags': s.algo_tags,
                'difficulty': s.difficulty, 'time_spent_min': s.time_spent_min,
                'source': s.source,
                'solved_at': s.solved_at.isoformat() if s.solved_at else None,
                'created_at': s.created_at.isoformat() if s.created_at else None,
            })
        return Response(rows)


class DBLearningStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import LearningStats
        rows = []
        for s in LearningStats.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': s.id, 'user_id': s.user_id, 'user_name': s.user.name,
                'stat_type': s.stat_type, 'stat_key': s.stat_key,
                'total_count': s.total_count, 'solved_count': s.solved_count,
                'failed_count': s.failed_count,
                'correct_rate': round(s.correct_rate, 2) if s.correct_rate else None,
                'last_solved_at': s.last_solved_at.isoformat() if s.last_solved_at else None,
                'updated_at': s.updated_at.isoformat() if s.updated_at else None,
            })
        return Response(rows)


class DBPortfolioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import Portfolio
        rows = []
        for p in Portfolio.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': p.id, 'user_id': p.user_id, 'user_name': p.user.name,
                'title': p.title, 'summary_text': p.summary_text,
                'content_json': p.content_json,
                'public_slug': p.public_slug, 'language': p.language,
                'version': p.version, 'is_public': p.is_public,
                'pdf_path': p.pdf_path,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'updated_at': p.updated_at.isoformat() if p.updated_at else None,
            })
        return Response(rows)


class DBJobPostingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import JobPosting
        rows = []
        for j in JobPosting.objects.select_related('company').all().order_by('id'):
            rows.append({
                'id': j.id, 'company_id': j.company_id,
                'company_name': j.company.name,
                'title': j.title, 'description': j.description,
                'required_skills': j.required_skills,
                'preferred_skills': j.preferred_skills,
                'job_role': j.job_role, 'career_level': j.career_level,
                'is_active': j.is_active, 'view_count': j.view_count,
                'deadline': j.deadline.isoformat() if j.deadline else None,
                'created_at': j.created_at.isoformat() if j.created_at else None,
            })
        return Response(rows)


class DBMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import Match
        rows = []
        for m in Match.objects.select_related('user', 'posting').all().order_by('id'):
            rows.append({
                'id': m.id, 'user_id': m.user_id, 'user_name': m.user.name,
                'posting_id': m.posting_id, 'posting_title': m.posting.title,
                'match_score': m.match_score, 'status': m.status,
                'applied_at': m.applied_at.isoformat() if m.applied_at else None,
                'created_at': m.created_at.isoformat() if m.created_at else None,
            })
        return Response(rows)


class DBPostView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import Post
        rows = []
        for p in Post.objects.select_related('author').all().order_by('id'):
            rows.append({
                'id': p.id, 'author_id': p.author_id, 'author_name': p.author.name,
                'category': p.category, 'title': p.title,
                'content': p.content[:100] + '...' if len(p.content) > 100 else p.content,
                'is_pinned': p.is_pinned, 'view_count': p.view_count,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'updated_at': p.updated_at.isoformat() if p.updated_at else None,
            })
        return Response(rows)


class DBAiLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import AiLog
        rows = []
        for a in AiLog.objects.select_related('user').all().order_by('id'):
            rows.append({
                'id': a.id,
                'user_id': a.user_id,
                'user_name': a.user.name if a.user else 'SYSTEM',
                'feature': a.feature, 'status': a.status,
                'prompt_tokens': a.prompt_tokens,
                'output_tokens': a.output_tokens,
                'latency_ms': a.latency_ms,
                'error_message': a.error_message,
                'created_at': a.created_at.isoformat() if a.created_at else None,
            })
        return Response(rows)


class DBSummaryView(APIView):
    """전체 테이블 건수 요약 — 대시보드 사이드바용"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import (User, Company, PlatformLink, UserGoal,
                                  Curriculum, SolveHistory, LearningStats,
                                  Portfolio, JobPosting, Match, Post, AiLog)
        return Response({
            'users':          User.objects.count(),
            'companies':      Company.objects.count(),
            'platform_links': PlatformLink.objects.count(),
            'user_goals':     UserGoal.objects.count(),
            'curricula':      Curriculum.objects.count(),
            'solve_history':  SolveHistory.objects.count(),
            'learning_stats': LearningStats.objects.count(),
            'portfolios':     Portfolio.objects.count(),
            'job_postings':   JobPosting.objects.count(),
            'matches':        Match.objects.count(),
            'posts':          Post.objects.count(),
            'ai_logs':        AiLog.objects.count(),
        })
