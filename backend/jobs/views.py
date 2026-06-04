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

import threading
import uuid
import logging
from datetime import date, timedelta

from rest_framework import status

logger = logging.getLogger(__name__)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from core.views_user import call_gemini, parse_json_from_gemini, default_curriculum
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

        # 직무 필터 UI 전용: 페이지네이션과 무관하게 전체 직무 목록을 반환
        if request.query_params.get('roles_only', '').lower() == 'true':
            roles = (qs.exclude(job_role__isnull=True).exclude(job_role='')
                       .values_list('job_role', flat=True).distinct().order_by('job_role'))
            return Response({
                "message": "직무 목록 조회 성공",
                "count": len(roles),
                "data": list(roles),
            }, status=status.HTTP_200_OK)

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

        total = qs.count()
        try:
            limit  = max(1, min(int(request.query_params.get('limit',  20)), 100))
            offset = max(0, int(request.query_params.get('offset', 0)))
        except (ValueError, TypeError):
            limit, offset = 20, 0

        page_qs = qs[offset: offset + limit]
        serializer = JobPostingListSerializer(page_qs, many=True, context={'request': request})
        return Response({
            "message": "공고 목록 조회 성공",
            "count": total,
            "limit": limit,
            "offset": offset,
            "has_next": offset + limit < total,
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

        total = qs.count()
        try:
            limit  = max(1, min(int(request.query_params.get('limit',  20)), 100))
            offset = max(0, int(request.query_params.get('offset', 0)))
        except (ValueError, TypeError):
            limit, offset = 20, 0

        serializer = MyMatchSerializer(qs[offset: offset + limit], many=True, context={'request': request})
        return Response({
            "message": "내 공고 목록 조회 성공",
            "count": total,
            "limit": limit,
            "offset": offset,
            "has_next": offset + limit < total,
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

        # ── 공고 맞춤 커리큘럼 생성 ──────────────
        # 기본: 공고의 필수/우대 기술 기반 생성 — Gemini 미사용.
        # 요청에 use_ai=true 를 명시한 경우에만 Gemini를 시도하고,
        # 실패하면 동일하게 공고 기술 기반으로 폴백한다.
        from core.models import Curriculum

        use_ai = str(request.data.get('use_ai', '')).lower() in ('1', 'true', 'yes')

        req_skills  = posting.required_skills  or []
        pref_skills = posting.preferred_skills or []

        raw, parsed = None, None
        if use_ai:
            raw, parsed = self._generate_with_gemini(
                request.user, posting, req_skills, pref_skills, duration_weeks
            )
            if not parsed:
                logger.warning(
                    "Gemini 스터디 커리큘럼 생성 실패 — 기본 커리큘럼으로 대체 (user_id=%s, posting_id=%s)",
                    request.user.id, posting_id,
                )

        content = parsed or default_curriculum(
            new_goal,
            required_skills=req_skills + pref_skills,
            duration_weeks=duration_weeks,
        )

        Curriculum.objects.create(
            user         = request.user,
            goal         = new_goal,
            is_active    = True,
            version      = 1,
            content_json = content,
        )

        ai_generated = parsed is not None
        return Response({
            "message": f"'{posting.job_role}' 직무로 {duration_weeks}주 공부를 시작합니다! "
                       f"{'AI가 공고 맞춤 커리큘럼을 생성했습니다.' if ai_generated else '공고 기술 기반 커리큘럼으로 시작합니다.'}",
            "goal": UserGoalSerializer(new_goal).data,
            "ai_generated": ai_generated,
            "target_posting": {
                "id": posting.id,
                "title": posting.title,
                "job_role": posting.job_role,
                "company_name": posting.company.name,
                "required_skills": posting.required_skills,
                "preferred_skills": posting.preferred_skills,
            },
        }, status=status.HTTP_201_CREATED)

    def _generate_with_gemini(self, user, posting, req_skills, pref_skills, duration_weeks):
        """use_ai=true 요청 시에만 호출되는 Gemini 공고 맞춤 커리큘럼 생성 (선택 기능)"""
        from core.models import LearningStats, SolveHistory

        solve_count = SolveHistory.objects.filter(user=user).count()
        langs = list(
            LearningStats.objects.filter(user=user, stat_type="language")
            .values_list("stat_key", flat=True)
        )

        req_str   = ', '.join(req_skills)  if req_skills  else '미정'
        pref_str  = ', '.join(pref_skills) if pref_skills else '없음'
        langs_str = ', '.join(langs)       if langs       else '미정'

        job_prompt = f"""당신은 취업 준비 학습 플랫폼 ELAW의 AI 커리큘럼 생성기입니다.
아래 채용공고를 목표로 {duration_weeks}주 집중 학습 커리큘럼을 JSON으로 생성해주세요.

[목표 채용공고]
- 회사: {posting.company.name}
- 포지션: {posting.title}
- 직무: {posting.job_role}
- 필수 기술: {req_str}
- 우대 기술: {pref_str}

[지원자 현황]
- 보유 언어 경험: {langs_str}
- 알고리즘 풀이 수: {solve_count}문제 (백준 기준)

[커리큘럼 생성 원칙 — 반드시 준수]
1. 커리큘럼 전체를 "{posting.job_role}" 직무 합격에 최적화
2. 필수 기술 [{req_str}]을 모두 커버 — 각 기술마다 최소 1주 배정
3. 우대 기술 [{pref_str}]은 중반 이후에 배치
4. 1주차는 {posting.job_role} 코딩테스트 빈출 알고리즘 (백준 문제번호 포함)
5. 2~{duration_weeks - 2}주차는 필수/우대 기술을 하나씩 집중 학습 (실습 과제 포함)
6. 마지막 2주는 실전 프로젝트 완성 + 포트폴리오 & 면접 준비
7. theme에 반드시 구체적인 기술명 포함 (예: "Django ORM & REST API 설계")
8. tasks는 실제로 수행 가능한 구체적인 실습 과제 3개

[JSON만 출력 — 코드블록·설명 텍스트 없이 순수 JSON]
{{"total_weeks":{duration_weeks},"field":"{posting.job_role}","job_role":"{posting.job_role}","required_skills":{req_skills},"preferred_skills":{pref_skills},"weeks":[{{"week":1,"theme":"구체적 주제명","tasks":["과제1","과제2","과제3"],"recommended_problems":["문제번호"],"estimated_hours":10}}]}}"""

        raw    = call_gemini(user, job_prompt, "curriculum_study")
        parsed = parse_json_from_gemini(raw)
        return raw, parsed


# ─────────────────────────────────────────
# 6. 취업 모드 + AI 포트폴리오 생성 ⭐ 신규
# ─────────────────────────────────────────

def _run_portfolio_generation(portfolio_id, posting_id, user_id, experience, applicant_name):
    """
    백그라운드 스레드에서 Ollama 추론을 수행하고 결과를 Portfolio에 기록.

    CPU 추론이 2~4분 걸리는데 Vercel 프록시(~75초)·Cloudflare 터널(~100초)이
    동기 응답을 기다리지 못하므로, JobApplyView는 즉시 202를 반환하고
    프론트엔드가 GET /api/jobs/portfolios/<id>/ 를 폴링해 완성을 확인한다.
    content_json.status: 'generating' → 'done' | 'error'
    """
    from django.db import connection
    try:
        posting = JobPosting.objects.select_related('company').get(id=posting_id)
        jd_text = build_jd_text(posting)
        ai_result = generate_portfolio(
            experience=experience,
            jd=jd_text,
            applicant_name=applicant_name,
        )

        portfolio = Portfolio.objects.get(id=portfolio_id)
        meta_section = {
            "type": "metadata",
            "target_posting_id": posting.id,
            "target_company": posting.company.name,
            "target_job_role": posting.job_role,
            "user_input_experience": experience,
            "ai_model": "mybot (Ollama)",
        }

        if ai_result['success']:
            meta_section["prompt_used"] = ai_result['prompt']
            portfolio.content_json = {
                "status": "done",
                "sections": [
                    {
                        "type": "ai_generated",
                        "title": "AI 생성 포트폴리오 본문",
                        "content": ai_result['content'],
                    },
                    meta_section,
                ],
            }
            portfolio.save()
            Match.objects.update_or_create(
                user_id=user_id,
                posting=posting,
                defaults={'status': 'applied'},
            )
            logger.info(f"[Portfolio AI] 비동기 생성 완료 — portfolio={portfolio_id}")
        else:
            portfolio.content_json = {
                "status": "error",
                "error": ai_result['error'],
                "sections": [meta_section],
            }
            portfolio.save()
            logger.error(f"[Portfolio AI] 비동기 생성 실패 — portfolio={portfolio_id}: {ai_result['error']}")
    except Exception as exc:  # 스레드에서 예외가 죽으면 폴링이 영원히 generating에 머무름
        logger.exception(f"[Portfolio AI] 비동기 생성 예외 — portfolio={portfolio_id}")
        try:
            Portfolio.objects.filter(id=portfolio_id).update(content_json={
                "status": "error",
                "error": f"서버 내부 오류: {exc}",
                "sections": [],
            })
        except Exception:
            pass
    finally:
        connection.close()  # 스레드 전용 DB 커넥션 정리


class JobApplyView(APIView):
    """
    POST /api/jobs/<id>/apply/

    취업 모드 진입 — AI(Ollama 'mybot') 가 포트폴리오 본문을 자동 생성.

    동작 (비동기):
      1. 사용자가 입력한 'experience' (경력/역할)을 받음
      2. Portfolio 행을 status='generating' 으로 즉시 생성하고 202 반환
      3. 백그라운드 스레드가 Ollama mybot 호출 → 완료 시 content_json 갱신
         + Match status='applied' (실패 시 status='error' + 사유 기록)
      4. 프론트엔드는 GET /api/jobs/portfolios/<id>/ 를 폴링해 완성 확인

    Body (필수):
        {
          "experience": "내가 했던 경력/프로젝트 텍스트 (여러 줄)",
          "title": "내 포트폴리오 제목 (선택)"
        }

    202 응답 즉시 반환 — 실제 생성은 2~4분 (CPU 추론)
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

        # 3. Portfolio 행을 placeholder 로 즉시 생성 (버전 +1)
        last_portfolio = Portfolio.objects.filter(user=request.user).order_by('-version').first()
        next_version = (last_portfolio.version + 1) if last_portfolio else 1

        # public_slug 자동 생성
        slug = f"{request.user.id}-{uuid.uuid4().hex[:8]}"

        portfolio_title = title or f"{posting.company.name} - {posting.title}"

        portfolio = Portfolio.objects.create(
            user=request.user,
            title=portfolio_title,
            summary_text=f"{posting.company.name} {posting.job_role} 지원용 포트폴리오",
            content_json={"status": "generating", "sections": []},
            public_slug=slug,
            language='ko',
            version=next_version,
            is_public=False,
        )

        # 4. 백그라운드 스레드에서 Ollama 추론 시작 (2~4분)
        threading.Thread(
            target=_run_portfolio_generation,
            args=(
                portfolio.id,
                posting.id,
                request.user.id,
                experience,
                (request.user.name or "").strip() or "지원자",
            ),
            daemon=True,
        ).start()

        # 5. 즉시 202 반환 — 프론트가 portfolios/<id>/ 폴링으로 완성 확인
        return Response({
            "message": f"'{posting.company.name} - {posting.title}' 지원용 "
                       f"포트폴리오 생성을 시작했습니다. (약 2~4분 소요)",
            "status": "generating",
            "portfolio": PortfolioDetailSerializer(portfolio).data,
        }, status=status.HTTP_202_ACCEPTED)


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