"""
jobs/views.py

채용 공고 페이지 + 공부/취업 모드 + 포트폴리오 API:

[1단계] 공고
- GET    /api/jobs/                       공고 목록 (검색/필터)
- GET    /api/jobs/<id>/                  공고 상세 + 조회수+1
- POST   /api/jobs/<id>/scrap/            스크랩
- DELETE /api/jobs/<id>/scrap/            스크랩 취소
- GET    /api/jobs/my/                    내 스크랩/지원 목록

[2단계] 공부 모드
- POST   /api/jobs/<id>/study/            공부 모드 (UserGoal 자동 생성)

[3단계] 취업 모드 + 포트폴리오 ⭐ 신규
- POST   /api/jobs/<id>/apply/            취업 모드 (포트폴리오 자동 생성)
- GET    /api/jobs/portfolios/            내 포트폴리오 목록
- GET    /api/jobs/portfolios/<id>/       포트폴리오 상세
- PATCH  /api/jobs/portfolios/<id>/       포트폴리오 수정
"""

import uuid
from datetime import date, timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q

from core.models import JobPosting, Match, UserGoal, Portfolio
from .serializers import (
    JobPostingListSerializer,
    JobPostingDetailSerializer,
    MyMatchSerializer,
    UserGoalSerializer,
    PortfolioListSerializer,
    PortfolioDetailSerializer,
)
from .portfolio_ai import generate_portfolio, build_jd_text


# ─────────────────────────────────────────
# 1. 공고 목록 / 검색 / 필터
# ─────────────────────────────────────────

class JobListView(APIView):
    """
    GET /api/jobs/

    Query Parameters:
      - q          : 제목/설명/회사명 검색
      - company    : 회사명 정확 매칭
      - job_role   : 직무
      - career_level : new / junior / senior / any
      - active_only : 'true' (기본값) - 활성 공고만
      - sort       : -created_at | -view_count | deadline
    """
    permission_classes = [AllowAny]

    def get(self, request):
        qs = JobPosting.objects.select_related('company').all()

        active_only = request.query_params.get('active_only', 'true').lower()
        if active_only != 'false':
            qs = qs.filter(is_active=True)

        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(description__icontains=q) |
                Q(company__name__icontains=q)
            )

        company = request.query_params.get('company', '').strip()
        if company:
            qs = qs.filter(company__name__icontains=company)

        job_role = request.query_params.get('job_role', '').strip()
        if job_role:
            qs = qs.filter(job_role__icontains=job_role)

        career_level = request.query_params.get('career_level', '').strip()
        if career_level:
            qs = qs.filter(career_level=career_level)

        sort = request.query_params.get('sort', '-created_at')
        valid_sorts = ['-created_at', 'created_at',
                       '-view_count', 'view_count',
                       'deadline', '-deadline']
        if sort not in valid_sorts:
            sort = '-created_at'
        qs = qs.order_by(sort)

        serializer = JobPostingListSerializer(qs, many=True, context={'request': request})
        return Response({
            "message": "공고 목록 조회 성공",
            "count": qs.count(),
            "data": serializer.data,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# 2. 공고 상세
# ─────────────────────────────────────────

class JobDetailView(APIView):
    """GET /api/jobs/<id>/  (조회수 +1)"""
    permission_classes = [AllowAny]

    def get(self, request, posting_id):
        try:
            posting = JobPosting.objects.select_related('company').get(id=posting_id)
        except JobPosting.DoesNotExist:
            return Response({
                "message": "해당 공고를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        JobPosting.objects.filter(id=posting_id).update(view_count=posting.view_count + 1)
        posting.view_count += 1

        serializer = JobPostingDetailSerializer(posting, context={'request': request})
        return Response({
            "message": f"{posting_id}번 공고 상세 조회 성공",
            "data": serializer.data,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# 3. 스크랩 / 스크랩 취소
# ─────────────────────────────────────────

class JobScrapView(APIView):
    """POST/DELETE /api/jobs/<id>/scrap/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, posting_id):
        try:
            posting = JobPosting.objects.get(id=posting_id)
        except JobPosting.DoesNotExist:
            return Response({
                "message": "해당 공고를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        match, created = Match.objects.get_or_create(
            user=request.user,
            posting=posting,
            defaults={
                'status': 'scrapped',
                'match_score': None,
            }
        )

        if not created:
            if match.status == 'applied':
                return Response({
                    "message": "이미 지원 완료한 공고입니다. 스크랩 상태로 변경할 수 없습니다.",
                    "current_status": match.status,
                }, status=status.HTTP_400_BAD_REQUEST)

            if match.status == 'scrapped':
                return Response({
                    "message": "이미 스크랩한 공고입니다.",
                    "current_status": match.status,
                }, status=status.HTTP_200_OK)

            match.status = 'scrapped'
            match.save(update_fields=['status', 'updated_at'])

        return Response({
            "message": "스크랩되었습니다.",
            "posting_id": posting_id,
            "status": match.status,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, posting_id):
        try:
            match = Match.objects.get(
                user=request.user,
                posting_id=posting_id,
                status='scrapped',
            )
        except Match.DoesNotExist:
            return Response({
                "message": "스크랩되지 않은 공고입니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        match.delete()
        return Response({
            "message": "스크랩이 취소되었습니다.",
            "posting_id": posting_id,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# 4. 내 스크랩/지원 목록
# ─────────────────────────────────────────

class MyJobsView(APIView):
    """GET /api/jobs/my/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Match.objects.filter(user=request.user).select_related(
            'posting', 'posting__company'
        )

        target_status = request.query_params.get('status', '').strip()
        if target_status:
            qs = qs.filter(status=target_status)
        else:
            qs = qs.filter(status__in=['scrapped', 'applied'])

        qs = qs.order_by('-updated_at')

        serializer = MyMatchSerializer(qs, many=True, context={'request': request})
        return Response({
            "message": "내 공고 목록 조회 성공",
            "count": qs.count(),
            "data": serializer.data,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# 5. 공부 모드 진입
# ─────────────────────────────────────────

class JobStudyView(APIView):
    """
    POST /api/jobs/<id>/study/

    공부 모드 진입 — UserGoal 자동 생성.
    Body (선택): {"duration_weeks": 8, "field": "컴퓨터"}
    Query: ?force=true (기존 활성 목표 비활성화)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, posting_id):
        try:
            posting = JobPosting.objects.select_related('company').get(id=posting_id)
        except JobPosting.DoesNotExist:
            return Response({
                "message": "해당 공고를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        duration_weeks = int(request.data.get('duration_weeks', 8))
        field = request.data.get('field', '컴퓨터').strip() or '컴퓨터'
        force = request.query_params.get('force', '').lower() == 'true'

        active_goal = UserGoal.objects.filter(
            user=request.user, is_active=True,
        ).first()

        if active_goal and active_goal.job_role == posting.job_role:
            return Response({
                "message": f"이미 '{posting.job_role}' 직무로 공부 중입니다.",
                "current_goal": UserGoalSerializer(active_goal).data,
            }, status=status.HTTP_200_OK)

        if active_goal and not force:
            return Response({
                "message": "이미 다른 공부 목표가 활성화되어 있습니다. "
                           "기존 목표를 비활성화하고 새 목표로 변경하시겠습니까?",
                "current_goal": UserGoalSerializer(active_goal).data,
                "new_target": {
                    "posting_id": posting.id,
                    "title": posting.title,
                    "job_role": posting.job_role,
                    "company_name": posting.company.name,
                },
                "hint": "확인하면 'POST /api/jobs/{id}/study/?force=true' 로 다시 호출해주세요.",
            }, status=status.HTTP_409_CONFLICT)

        if active_goal and force:
            UserGoal.objects.filter(
                user=request.user, is_active=True,
            ).update(is_active=False)

        start_date = date.today()
        end_date = start_date + timedelta(weeks=duration_weeks)
        mid_eval_date = start_date + timedelta(weeks=duration_weeks // 2)

        new_goal = UserGoal.objects.create(
            user=request.user,
            goal_type='study',
            field=field,
            job_role=posting.job_role or '백엔드 개발자',
            start_date=start_date,
            end_date=end_date,
            mid_eval_date=mid_eval_date,
            duration_weeks=duration_weeks,
            is_active=True,
        )

        Match.objects.get_or_create(
            user=request.user,
            posting=posting,
            defaults={
                'status': 'scrapped',
                'match_score': None,
            }
        )

        return Response({
            "message": f"'{posting.job_role}' 직무로 {duration_weeks}주 공부를 시작합니다! "
                       f"AI가 곧 맞춤 커리큘럼과 추천 문제를 준비할 예정입니다.",
            "goal": UserGoalSerializer(new_goal).data,
            "target_posting": {
                "id": posting.id,
                "title": posting.title,
                "job_role": posting.job_role,
                "company_name": posting.company.name,
                "required_skills": posting.required_skills,
                "preferred_skills": posting.preferred_skills,
            },
        }, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────
# 6. 취업 모드 + AI 포트폴리오 생성 ⭐ 신규
# ─────────────────────────────────────────

class JobApplyView(APIView):
    """
    POST /api/jobs/<id>/apply/

    취업 모드 진입 — AI(Ollama 'mybot') 가 포트폴리오 본문을 자동 생성.

    동작:
      1. 사용자가 입력한 'experience' (경력/역할)을 받음
      2. 공고의 description + skills 로 JD 텍스트 조립
      3. Ollama mybot 호출 → 포트폴리오 본문 생성
      4. Portfolio 모델에 저장 (버전 +1)
      5. Match 의 status='applied' 로 업데이트
      6. 응답: 포트폴리오 ID + 생성된 본문

    Body (필수):
        {
          "experience": "내가 했던 경력/프로젝트 텍스트 (여러 줄)",
          "title": "내 포트폴리오 제목 (선택)"
        }

    응답 시간: 30초~120초 (Ollama 모델 추론 시간)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, posting_id):
        # 1. 공고 조회
        try:
            posting = JobPosting.objects.select_related('company').get(id=posting_id)
        except JobPosting.DoesNotExist:
            return Response({
                "message": "해당 공고를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        # 2. 입력 받기
        experience = (request.data.get('experience') or '').strip()
        title = (request.data.get('title') or '').strip()

        if not experience:
            return Response({
                "message": "경력 내용(experience)을 입력해주세요.",
                "hint": "본인이 다녔던 직장, 진행한 프로젝트, 역할 등을 자유롭게 작성하세요.",
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(experience) < 20:
            return Response({
                "message": "경력 내용이 너무 짧습니다. 최소 20자 이상 입력해주세요.",
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. JD 텍스트 조립
        jd_text = build_jd_text(posting)

        # 4. Ollama 호출 (시간 걸림: 30~120초)
        ai_result = generate_portfolio(experience=experience, jd=jd_text)

        if not ai_result['success']:
            return Response({
                "message": "포트폴리오 생성에 실패했습니다.",
                "error": ai_result['error'],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        generated_content = ai_result['content']
        prompt_used = ai_result['prompt']

        # 5. 기존 포트폴리오 조회 (없으면 생성, 있으면 버전 +1)
        last_portfolio = Portfolio.objects.filter(user=request.user).order_by('-version').first()
        next_version = (last_portfolio.version + 1) if last_portfolio else 1

        # public_slug 자동 생성
        slug = f"{request.user.id}-{uuid.uuid4().hex[:8]}"

        portfolio_title = title or f"{posting.company.name} - {posting.title}"

        portfolio = Portfolio.objects.create(
            user=request.user,
            title=portfolio_title,
            summary_text=f"{posting.company.name} {posting.job_role} 지원용 포트폴리오",
            content_json={
                "sections": [
                    {
                        "type": "ai_generated",
                        "title": "AI 생성 포트폴리오 본문",
                        "content": generated_content,
                    },
                    {
                        "type": "metadata",
                        "target_posting_id": posting.id,
                        "target_company": posting.company.name,
                        "target_job_role": posting.job_role,
                        "user_input_experience": experience,
                        "ai_model": "mybot (Ollama)",
                        "prompt_used": prompt_used,
                    },
                ]
            },
            public_slug=slug,
            language='ko',
            version=next_version,
            is_public=False,
        )

        # 6. Match 의 status='applied' 로 업데이트 (없으면 생성)
        match, _ = Match.objects.update_or_create(
            user=request.user,
            posting=posting,
            defaults={
                'status': 'applied',
            }
        )

        return Response({
            "message": f"'{posting.company.name} - {posting.title}' 지원용 "
                       f"포트폴리오가 생성되었습니다!",
            "portfolio": PortfolioDetailSerializer(portfolio).data,
            "match": {
                "id": match.id,
                "status": match.status,
            },
        }, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────
# 7. 내 포트폴리오 목록 ⭐ 신규
# ─────────────────────────────────────────

class PortfolioListView(APIView):
    """GET /api/jobs/portfolios/  — 내 포트폴리오 목록"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Portfolio.objects.filter(user=request.user).order_by('-updated_at')

        serializer = PortfolioListSerializer(qs, many=True)
        return Response({
            "message": "내 포트폴리오 목록 조회 성공",
            "count": qs.count(),
            "data": serializer.data,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# 8. 포트폴리오 상세 / 수정 ⭐ 신규
# ─────────────────────────────────────────

class PortfolioDetailView(APIView):
    """
    GET   /api/jobs/portfolios/<id>/    포트폴리오 상세
    PATCH /api/jobs/portfolios/<id>/    포트폴리오 수정 (제목/공개여부/내용)
    DELETE /api/jobs/portfolios/<id>/   포트폴리오 삭제
    """
    permission_classes = [IsAuthenticated]

    def _get_portfolio(self, portfolio_id, user):
        try:
            portfolio = Portfolio.objects.get(id=portfolio_id)
        except Portfolio.DoesNotExist:
            return None

        # 본인 포트폴리오만 접근 가능
        if portfolio.user_id != user.id:
            raise PermissionDenied("본인의 포트폴리오만 조회할 수 있습니다.")
        return portfolio

    def get(self, request, portfolio_id):
        portfolio = self._get_portfolio(portfolio_id, request.user)
        if not portfolio:
            return Response({
                "message": "해당 포트폴리오를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = PortfolioDetailSerializer(portfolio)
        return Response({
            "message": "포트폴리오 조회 성공",
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    def patch(self, request, portfolio_id):
        portfolio = self._get_portfolio(portfolio_id, request.user)
        if not portfolio:
            return Response({
                "message": "해당 포트폴리오를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = PortfolioDetailSerializer(portfolio, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "포트폴리오가 수정되었습니다.",
                "data": serializer.data,
            }, status=status.HTTP_200_OK)

        return Response({
            "message": "입력값이 올바르지 않습니다.",
            "errors": serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, portfolio_id):
        portfolio = self._get_portfolio(portfolio_id, request.user)
        if not portfolio:
            return Response({
                "message": "해당 포트폴리오를 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        portfolio.delete()
        return Response({
            "message": "포트폴리오가 삭제되었습니다.",
        }, status=status.HTTP_200_OK)