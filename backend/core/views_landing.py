"""
core/views_landing.py
랜딩 페이지 공개 API — 비로그인 사용자용

GET /api/core/landing/   ← 직군/기업/이벤트/통계를 한 번에 반환

기존에 프론트엔드가 supabase-js(anon key + RLS)로 직접 조회하던 데이터를
대체한다 (2026-06-06 컨테이너 통합 이전, Supabase 의존 제거).
"""

from django.db.models import Count
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class LandingView(APIView):
    """랜딩 페이지 데이터 일괄 조회 (인증 불필요, 읽기 전용)"""

    permission_classes = [AllowAny]

    def get(self, request):
        from core.models import Company, JobPosting, Post
        from core.models_problems import JobProblem, LearningPathMeta

        # 직군별 학습경로 메타 (30행 내외 — 전체 반환, 노출 직군은 FE가 선별)
        roles = list(
            LearningPathMeta.objects
            .values('job_role', 'total_problems', 'cluster_count')
            .order_by('job_role')
        )

        # 승인된 기업 + 공고 수 (랜딩 카드 4개)
        companies = [
            {
                'name': c.name,
                'industry': c.industry,
                'posting_count': c.posting_count,
            }
            for c in (
                Company.objects
                .filter(is_approved=True)
                .annotate(posting_count=Count('job_postings'))
                .order_by('-posting_count')[:4]
            )
        ]

        # 대회/이벤트 게시글 상위 3개 (조회수순)
        posts = list(
            Post.objects
            .filter(category__in=[Post.Category.CONTEST, Post.Category.EVENT])
            .order_by('-view_count')
            .values('id', 'title', 'category', 'content', 'view_count')[:3]
        )

        stats = {
            'problems':  JobProblem.objects.count(),
            'roles':     LearningPathMeta.objects.count(),
            'postings':  JobPosting.objects.count(),
            'companies': Company.objects.count(),
        }

        return Response({
            'roles': roles,
            'companies': companies,
            'posts': posts,
            'stats': stats,
        })
