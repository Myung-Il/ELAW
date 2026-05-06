"""
core/views_solve.py

문제 풀이 & 추천 파이프라인 API

GET  /api/core/problems/                     JobProblemListView
POST /api/core/problems/<problem_id>/solve/  SolveProblemView
GET  /api/core/recommendations/              RecommendationView
GET  /api/core/skill-gaps/                   SkillGapView
POST /api/core/portfolio/generate/           PortfolioGenerateView
POST /api/core/portfolio/feedback/           PortfolioFeedbackView
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status


# ──────────────────────────────────────────────────────────────
# 1. 문제 목록
# ──────────────────────────────────────────────────────────────

class JobProblemListView(APIView):
    """
    GET /api/core/problems/
    쿼리 파라미터:
      ?job_role=AI+Engineer
      ?difficulty=junior_level
      ?category=Machine+Learning
      ?page=1&page_size=20  (기본 page_size=20)
    응답: 문제 목록 (correct_answer 제외)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models_problems import JobProblem

        qs = JobProblem.objects.all().order_by('job_role', 'original_question_id')

        job_role   = request.query_params.get('job_role')
        difficulty = request.query_params.get('difficulty')
        category   = request.query_params.get('category')
        q_type     = request.query_params.get('question_type')

        if job_role:
            qs = qs.filter(job_role=job_role)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        if category:
            qs = qs.filter(category__icontains=category)
        if q_type:
            qs = qs.filter(question_type=q_type)

        # 페이지네이션
        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 20))))
        except (ValueError, TypeError):
            page, page_size = 1, 20

        total = qs.count()
        start = (page - 1) * page_size
        end   = start + page_size

        problems = []
        for p in qs[start:end]:
            problems.append({
                'id':                   p.pk,
                'original_question_id': p.original_question_id,
                'job_role':             p.job_role,
                'difficulty':           p.difficulty,
                'question_type':        p.question_type,
                'category':             p.category,
                'subcategory':          p.subcategory,
                'skills_required':      p.skills_required or [],
                'scenario':             p.scenario,
                'question':             p.question,
                'choices':              p.choices or [],
                'total_attempts':       p.total_attempts,
                'avg_correct_rate':     p.avg_correct_rate,
            })

        return Response({
            'count':     total,
            'page':      page,
            'page_size': page_size,
            'results':   problems,
        })


# ──────────────────────────────────────────────────────────────
# 2. 문제 풀이 제출
# ──────────────────────────────────────────────────────────────

# 난이도별 XP
_DIFFICULTY_XP = {
    'university_level': 10,
    'junior_level':     20,
    'middle_level':     40,
    'senior_level':     80,
}


class SolveProblemView(APIView):
    """
    POST /api/core/problems/<problem_id>/solve/
    요청: {"selected_answer": "SGD", "time_spent_sec": 45}
    응답: {is_correct, correct_answer, explanation, mastery_pct, xp_gained}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, problem_id: int):
        from core.models_problems import JobProblem, JobProblemSolveHistory
        from core.services.recommender_service import RecommenderService

        # 문제 조회
        try:
            problem = JobProblem.objects.get(pk=problem_id)
        except JobProblem.DoesNotExist:
            return Response(
                {'error': f'문제 ID {problem_id}를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        selected_answer = request.data.get('selected_answer', '').strip()
        time_spent_sec  = request.data.get('time_spent_sec')

        if not selected_answer:
            return Response(
                {'error': 'selected_answer는 필수입니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 정답 판별 (대소문자 무시 비교)
        is_correct = (
            selected_answer.lower() == (problem.correct_answer or '').lower()
        )
        solve_status = (
            JobProblemSolveHistory.Status.CORRECT
            if is_correct else
            JobProblemSolveHistory.Status.INCORRECT
        )

        # 풀이 기록 저장 (signals.py → SkillGap 재계산 자동 트리거)
        history = JobProblemSolveHistory.objects.create(
            user=request.user,
            problem=problem,
            status=solve_status,
            selected_answer=selected_answer,
            time_spent_sec=int(time_spent_sec) if time_spent_sec else None,
        )

        # BKT mastery 계산
        svc = RecommenderService()
        bkt = svc._rebuild_bkt(request.user, problem.job_role)
        mastery_pct = round(bkt.mastery(problem.original_question_id) * 100, 1)

        # XP 계산 (정답만 지급, 오답은 0)
        xp_gained = _DIFFICULTY_XP.get(problem.difficulty, 10) if is_correct else 0

        return Response({
            'is_correct':     is_correct,
            'correct_answer': problem.correct_answer,
            'explanation':    problem.explanation or '',
            'mastery_pct':    mastery_pct,
            'xp_gained':      xp_gained,
        })


# ──────────────────────────────────────────────────────────────
# 3. 추천 문제 목록
# ──────────────────────────────────────────────────────────────

class RecommendationView(APIView):
    """
    GET /api/core/recommendations/
    쿼리: ?job_role=AI+Engineer&top_n=10
    응답: RecommenderService.recommend() 결과 (correct_answer 포함)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.services.recommender_service import RecommenderService

        job_role = request.query_params.get('job_role', '').strip()
        if not job_role:
            return Response(
                {'error': 'job_role 파라미터는 필수입니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            top_n = min(50, max(1, int(request.query_params.get('top_n', 10))))
        except (ValueError, TypeError):
            top_n = 10

        svc     = RecommenderService()
        results = svc.recommend(request.user, job_role, top_n=top_n)

        return Response({
            'job_role': job_role,
            'top_n':    top_n,
            'count':    len(results),
            'results':  results,
        })


# ──────────────────────────────────────────────────────────────
# 4. 스킬 갭 조회
# ──────────────────────────────────────────────────────────────

class SkillGapView(APIView):
    """
    GET /api/core/skill-gaps/
    쿼리: ?posting_id=<id>  (없으면 전체)
    응답: SkillGap 목록 (gap_score 내림차순)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models_new import SkillGap

        qs = SkillGap.objects.filter(user=request.user).order_by('-gap_score')

        posting_id = request.query_params.get('posting_id')
        if posting_id:
            try:
                qs = qs.filter(posting_id=int(posting_id))
            except (ValueError, TypeError):
                return Response(
                    {'error': 'posting_id는 정수여야 합니다.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        gaps = []
        for gap in qs.select_related('posting'):
            gaps.append({
                'id':             gap.pk,
                'skill_name':     gap.skill_name,
                'skill_category': gap.skill_category,
                'current_level':  gap.current_level,
                'required_level': gap.required_level,
                'gap_score':      gap.gap_score,
                'posting_id':     gap.posting_id,
                'posting_title':  gap.posting.title if gap.posting else None,
                'calculated_at':  gap.calculated_at.isoformat(),
                'updated_at':     gap.updated_at.isoformat(),
            })

        return Response({
            'count':   len(gaps),
            'results': gaps,
        })


# ──────────────────────────────────────────────────────────────
# 5. 포트폴리오 생성
# ──────────────────────────────────────────────────────────────

class PortfolioGenerateView(APIView):
    """
    POST /api/core/portfolio/generate/
    요청: {"posting_id": 1}  (optional)
    응답: PortfolioService.generate() 결과
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from core.services.portfolio_service import PortfolioService

        posting = None
        posting_id = request.data.get('posting_id')
        if posting_id:
            from core.models import JobPosting
            try:
                posting = JobPosting.objects.get(pk=int(posting_id))
            except (JobPosting.DoesNotExist, ValueError, TypeError):
                return Response(
                    {'error': f'posting_id {posting_id}를 찾을 수 없습니다.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        svc    = PortfolioService()
        result = svc.generate(request.user, posting=posting)

        return Response(result, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────
# 6. 포트폴리오 피드백
# ──────────────────────────────────────────────────────────────

class PortfolioFeedbackView(APIView):
    """
    POST /api/core/portfolio/feedback/
    요청: {"snapshot_id": 1, "rating": 4, "feedback_text": "..."}
    응답: {feedback_id, snapshot_id, rating, message}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from core.models_new import PortfolioSnapshot, PortfolioFeedback

        snapshot_id   = request.data.get('snapshot_id')
        rating        = request.data.get('rating')
        feedback_text = request.data.get('feedback_text', '')

        # 입력 검증
        if not snapshot_id:
            return Response(
                {'error': 'snapshot_id는 필수입니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            rating = int(rating)
            if not (1 <= rating <= 5):
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {'error': 'rating은 1~5 사이의 정수여야 합니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 스냅샷 조회 (본인 소유 확인)
        try:
            snapshot = PortfolioSnapshot.objects.get(
                pk=int(snapshot_id), user=request.user
            )
        except (PortfolioSnapshot.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': f'snapshot_id {snapshot_id}를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 피드백 저장 (snapshot + user 기준 unique — 기존 피드백 업데이트)
        feedback, created = PortfolioFeedback.objects.update_or_create(
            snapshot=snapshot,
            user=request.user,
            defaults={
                'rating':        rating,
                'feedback_text': feedback_text,
            },
        )

        return Response(
            {
                'feedback_id':  feedback.pk,
                'snapshot_id':  snapshot.pk,
                'rating':       feedback.rating,
                'feedback_text': feedback.feedback_text,
                'created':      created,
                'message':      '피드백이 저장되었습니다.',
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
