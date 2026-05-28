"""
core/views_quiz.py

SeedQuiz → Voting → Recommend 파이프라인 Django 연동
Django session(DB)으로 퀴즈 상태 유지

엔드포인트:
  POST   /api/core/quiz/start/             퀴즈 세션 시작
  POST   /api/core/quiz/submit/            답안 제출
  GET    /api/core/quiz/progress/          진행 상태 조회
  POST   /api/core/quiz/complete/          퀴즈 종료 & 추천 생성
  POST   /api/core/quiz/recommend/update/  추천 문제 풀이 후 업데이트
"""

import sys
import os

# 프로젝트 루트 및 models/curriculum 을 sys.path에 추가
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_CURRICULUM_ROOT = os.path.join(_PROJECT_ROOT, "models", "curriculum")
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
if _CURRICULUM_ROOT not in sys.path:
    sys.path.insert(0, _CURRICULUM_ROOT)

from collections import deque

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

# UserGoal.job_role(한글 포함) → JobProblem.job_role(영문) 정규화 매핑
_ROLE_MAP = {
    '백엔드 개발자':       'Backend Engineer',
    '프론트엔드 개발자':   'Frontend Developer',
    'AI 엔지니어':         'AI Engineer',
    '데이터 분석가':       'Data Scientist',
    '데이터 엔지니어':     'Data Engineer',
    '풀스택 개발자':       'Full Stack Engineer',
    '풀 스택 개발자':      'Full Stack Engineer',
    '데브옵스 엔지니어':   'DevOps Engineer',
    '안드로이드 개발자':   'Mobile App Developer',
    'iOS 개발자':          'Mobile App Developer',
    '보안 엔지니어':       'Security Engineer',
    '임베디드 개발자':     'Embedded Systems Engineer',
    '머신러닝 연구원':     'Machine Learning Researcher',
    '게임 개발자':         'Game Developer',
    '클라우드 엔지니어':   'Cloud Infrastructure Engineer',
    # 영문 변형 정규화
    'Backend Developer':   'Backend Engineer',
    'Frontend Engineer':   'Frontend Developer',
}

def _normalize_role(job_role: str) -> str:
    """한글/변형 job_role → JobProblem DB의 영문 job_role로 변환."""
    return _ROLE_MAP.get(job_role, job_role)

from .models_problems import (
    JobProblem, ProblemEdge, LearningPathMeta,
    QuizSession, RecommendSession,
)
from .models import UserGoal

try:
    from models.curriculum.seedquiz import SeedQuiz
    from models.curriculum.voting import Voting
    from models.curriculum.recommend import Recommend
    ML_AVAILABLE = True
except Exception as _e:
    ML_AVAILABLE = False
    _ML_ERROR = str(_e)


# ─────────────────────────────────────────
# 헬퍼 함수
# ─────────────────────────────────────────

def _build_problems_dict(job_role: str) -> dict:
    """DB → SeedQuiz/Recommend에 주입할 problems dict 생성."""
    return {
        p.original_question_id: {
            "question_id":    p.original_question_id,
            "difficulty":     p.difficulty,
            "category":       p.category,
            "subcategory":    p.subcategory or "",
            "question":       p.question,
            "choices":        p.choices,
            "correct_answer": p.correct_answer,
            "explanation":    p.explanation or "",
        }
        for p in JobProblem.objects.filter(job_role=job_role)
    }


def _build_dependency_graph(job_role: str) -> dict:
    """ProblemEdge DB → dependency_graph dict."""
    nodes = [
        {"question_id": p.original_question_id, "category": p.category,
         "subcategory": p.subcategory or ""}
        for p in JobProblem.objects.filter(job_role=job_role).only(
            "original_question_id", "category", "subcategory"
        )
    ]
    edges = [
        {
            "source_id":      e.source_problem.original_question_id,
            "target_id":      e.target_problem.original_question_id,
            "combined_score": e.combined_score,
        }
        for e in ProblemEdge.objects.filter(
            job_role=job_role, is_prerequisite=True
        ).select_related("source_problem", "target_problem")
    ]
    return {"nodes": nodes, "edges": edges}


def _build_ordered_path(job_role: str) -> list:
    """
    Kahn's 알고리즘으로 선수과목 위상 정렬 → ordered_path 생성.
    사이클이 있는 경우 나머지 노드를 뒤에 추가.
    """
    all_ids = list(
        JobProblem.objects.filter(job_role=job_role)
        .values_list("original_question_id", flat=True)
    )
    id_set = set(all_ids)

    # source → target 방향으로 진입차수 계산
    in_degree = {qid: 0 for qid in id_set}
    adj = {qid: [] for qid in id_set}

    for e in ProblemEdge.objects.filter(job_role=job_role, is_prerequisite=True).select_related(
        "source_problem", "target_problem"
    ):
        s = e.source_problem.original_question_id
        t = e.target_problem.original_question_id
        if s in id_set and t in id_set:
            adj[s].append(t)
            in_degree[t] += 1

    queue = deque(qid for qid in id_set if in_degree[qid] == 0)
    ordered = []
    while queue:
        node = queue.popleft()
        ordered.append(node)
        for neighbor in adj[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # 사이클이 있는 경우 나머지 추가
    remaining = [qid for qid in all_ids if qid not in set(ordered)]
    ordered.extend(remaining)
    return ordered


# request.session 대신 DB 모델 사용 — SESSION_KEY/RECOMMEND_KEY 불필요


# ─────────────────────────────────────────
# 1. 퀴즈 시작
# ─────────────────────────────────────────

class QuizStartView(APIView):
    """
    POST /api/core/quiz/start/
    Body: {} (선택: job_role — 없으면 활성 UserGoal.job_role 사용)
    Response: {questions: [...10문제, correct_answer 제외]}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not ML_AVAILABLE:
            return Response(
                {"error": f"ML 모듈을 불러올 수 없습니다: {_ML_ERROR}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        job_role = request.data.get("job_role", "").strip()
        if not job_role:
            goal = UserGoal.objects.filter(user=request.user, is_active=True).first()
            if not goal:
                return Response(
                    {"error": "활성 목표가 없습니다. 먼저 목표를 설정해주세요."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            job_role = _normalize_role(goal.job_role)

        problems = _build_problems_dict(job_role)
        if not problems:
            return Response(
                {"error": f"'{job_role}' 직군의 문제 데이터가 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        ordered_path = _build_ordered_path(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        QuizSession.objects.update_or_create(
            user=request.user,
            defaults={"job_role": job_role, "session_data": quiz.export_session()},
        )

        return Response({
            "job_role": job_role,
            "questions": quiz.get_all_questions(),
            "total": len(quiz.get_all_questions()),
        })


# ─────────────────────────────────────────
# 2. 답안 제출
# ─────────────────────────────────────────

class QuizSubmitView(APIView):
    """
    POST /api/core/quiz/submit/
    Body: {index: int, answer: str}
    Response: {is_correct, correct_answer, explanation, progress}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not ML_AVAILABLE:
            return Response({"error": "ML 모듈 사용 불가"}, status=503)

        qs_obj = QuizSession.objects.filter(user=request.user).first()
        if not qs_obj:
            return Response({"error": "퀴즈 세션이 없습니다. /quiz/start/ 를 먼저 호출하세요."}, status=400)

        index = request.data.get("index")
        answer = request.data.get("answer", "")
        if index is None:
            return Response({"error": "index 필드가 필요합니다."}, status=400)

        job_role = qs_obj.job_role
        problems = _build_problems_dict(job_role)
        ordered_path = _build_ordered_path(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(qs_obj.session_data)

        result = quiz.submit(int(index), answer)

        qs_obj.session_data = quiz.export_session()
        qs_obj.save(update_fields=["session_data", "updated_at"])

        return Response({
            **result,
            "progress": quiz.get_progress(),
        })


# ─────────────────────────────────────────
# 3. 진행 상태 조회
# ─────────────────────────────────────────

class QuizProgressView(APIView):
    """GET /api/core/quiz/progress/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs_obj = QuizSession.objects.filter(user=request.user).first()
        if not qs_obj:
            return Response({"has_session": False})

        if not ML_AVAILABLE:
            return Response({"error": "ML 모듈 사용 불가"}, status=503)

        problems     = _build_problems_dict(qs_obj.job_role)
        ordered_path = _build_ordered_path(qs_obj.job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(qs_obj.session_data)

        return Response(quiz.get_progress())


# ─────────────────────────────────────────
# 4. 퀴즈 완료 & 추천 생성
# ─────────────────────────────────────────

class QuizCompleteView(APIView):
    """
    POST /api/core/quiz/complete/
    Response: {zone, weights, recommendations: [...top 5]}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not ML_AVAILABLE:
            return Response({"error": "ML 모듈 사용 불가"}, status=503)

        qs_obj = QuizSession.objects.filter(user=request.user).first()
        if not qs_obj:
            return Response({"error": "퀴즈 세션이 없습니다."}, status=400)

        job_role     = qs_obj.job_role
        problems     = _build_problems_dict(job_role)
        ordered_path = _build_ordered_path(job_role)
        dep_graph    = _build_dependency_graph(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(qs_obj.session_data)
        quiz_result = quiz.get_result()

        voting = Voting(quiz_result)
        rec = Recommend(
            status=voting.get_status(),
            problems=problems,
            responses=quiz_result["responses"],
            dependency_graph=dep_graph,
        )
        recommendations = rec.get_recommendations(top_n=5)

        RecommendSession.objects.update_or_create(
            user=request.user,
            defaults={
                "job_role":        job_role,
                "zone":            voting.get_zone(),
                "weights":         voting.get_weights(),
                "weak_categories": voting.get_weak_categories(),
                "responses":       quiz_result["responses"],
                "recommendations": recommendations,
            },
        )

        return Response({
            "accuracy": quiz_result["accuracy"],
            "zone": voting.get_zone(),
            "weights": voting.get_weights(),
            "weak_categories": voting.get_weak_categories(),
            "recommendations": recommendations,
        })


# ─────────────────────────────────────────
# 5. 추천 문제 풀이 후 업데이트
# ─────────────────────────────────────────

class ProblemsView(APIView):
    """GET /api/core/problems/?limit=200&job_role=..."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit    = min(int(request.query_params.get('limit', 50)), 500)
        job_role = request.query_params.get('job_role', '').strip()

        if not job_role:
            goal = UserGoal.objects.filter(user=request.user, is_active=True).first()
            job_role = _normalize_role(goal.job_role) if goal else ''

        qs = JobProblem.objects.all()
        if job_role:
            qs = qs.filter(job_role=job_role)
        qs = qs.order_by('original_question_id')[:limit]

        return Response([
            {
                'id':              p.id,
                'question_id':     p.original_question_id,
                'job_role':        p.job_role,
                'category':        p.category,
                'subcategory':     p.subcategory or '',
                'difficulty':      p.difficulty,
                'question_type':   p.question_type or '',
                'skills_required': p.skills_required or [],
                'question':        p.question,
                'choices':         p.choices or [],
            }
            for p in qs
        ])


class QuizRecommendView(APIView):
    """GET /api/core/quiz/recommend/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rs_obj = RecommendSession.objects.filter(user=request.user).first()
        if not rs_obj:
            return Response({'status': 'no_recommend'})
        return Response({
            'status':          'has_recommend',
            'zone':            rs_obj.zone,
            'weights':         rs_obj.weights,
            'weak_categories': rs_obj.weak_categories,
            'recommendations': rs_obj.recommendations,
        })


class QuizQuestionsView(APIView):
    """GET /api/core/quiz/questions/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs_obj = QuizSession.objects.filter(user=request.user).first()
        if not qs_obj:
            return Response({'error': '퀴즈 세션이 없습니다.'}, status=400)

        if not ML_AVAILABLE:
            return Response({'error': 'ML 모듈 사용 불가'}, status=503)

        problems     = _build_problems_dict(qs_obj.job_role)
        ordered_path = _build_ordered_path(qs_obj.job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(qs_obj.session_data)

        return Response({
            'questions': quiz.get_all_questions(),
            'total':     len(quiz.get_all_questions()),
            'progress':  quiz.get_progress(),
        })


class QuizStatsView(APIView):
    """GET /api/core/quiz/stats/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models_problems import JobProblemSolveHistory
        from django.db.models import Count

        qs = JobProblemSolveHistory.objects.filter(user=request.user).select_related('problem')
        total   = qs.count()
        correct = qs.filter(status='correct').count()
        accuracy = round(correct / total * 100, 1) if total else 0

        cats = (
            qs.values('problem__category')
              .annotate(attempts=Count('id'))
              .order_by('-attempts')
        )
        categories = []
        for c in cats:
            cat        = c['problem__category']
            cat_correct = qs.filter(problem__category=cat, status='correct').count()
            categories.append({
                'category': cat,
                'attempts': c['attempts'],
                'correct':  cat_correct,
                'accuracy': round(cat_correct / c['attempts'] * 100, 1) if c['attempts'] else 0,
            })

        return Response({
            'total_attempts': total,
            'correct_count':  correct,
            'accuracy':       accuracy,
            'categories':     categories,
        })


class QuizAnswerView(APIView):
    """POST /api/core/quiz/answer/ — 추천 문제 단독 정답 확인"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question_id = request.data.get('question_id')
        answer      = request.data.get('answer', '')

        # job_role 결정: RecommendSession → QuizSession → 활성 목표 순으로 폴백
        raw_role = (
            request.data.get('job_role', '').strip()
            or getattr(RecommendSession.objects.filter(user=request.user).first(), 'job_role', '')
            or getattr(QuizSession.objects.filter(user=request.user).first(), 'job_role', '')
            or getattr(UserGoal.objects.filter(user=request.user, is_active=True).first(), 'job_role', '')
        )
        job_role = _normalize_role(raw_role)

        qs = JobProblem.objects.filter(original_question_id=question_id)
        if job_role:
            qs = qs.filter(job_role=job_role)

        problem = qs.first()
        if not problem:
            return Response({'error': '문제를 찾을 수 없습니다.'}, status=404)

        is_correct = (str(answer).strip() == str(problem.correct_answer).strip())

        # 풀이 이력 저장
        from .models_problems import JobProblemSolveHistory
        JobProblemSolveHistory.objects.create(
            user=request.user,
            problem=problem,
            status=JobProblemSolveHistory.Status.CORRECT if is_correct else JobProblemSolveHistory.Status.INCORRECT,
            selected_answer=str(answer),
        )

        return Response({
            'is_correct':     is_correct,
            'correct_answer': problem.correct_answer,
            'explanation':    problem.explanation or '',
        })


class RecommendUpdateView(APIView):
    """
    POST /api/core/quiz/recommend/update/
    Body: {question_id, is_correct, category, subcategory, top_n?}
    Response: {recommendations: [...]}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not ML_AVAILABLE:
            return Response({"error": "ML 모듈 사용 불가"}, status=503)

        rs_obj = RecommendSession.objects.filter(user=request.user).first()
        if not rs_obj:
            return Response({"error": "추천 세션이 없습니다. /quiz/complete/ 를 먼저 호출하세요."}, status=400)

        question_id = request.data.get("question_id")
        is_correct  = request.data.get("is_correct", False)
        category    = request.data.get("category", "")
        subcategory = request.data.get("subcategory", "")
        top_n       = int(request.data.get("top_n", 5))

        problems  = _build_problems_dict(rs_obj.job_role)
        dep_graph = _build_dependency_graph(rs_obj.job_role)

        responses = rs_obj.responses
        total     = len(responses)
        correct   = sum(1 for r in responses if r.get("is_correct", False))
        mock_result = {
            "total":     total,
            "correct":   correct,
            "accuracy":  correct / total * 100 if total else 0.0,
            "responses": responses,
        }
        voting = Voting(mock_result)
        voting.update(bool(is_correct))

        rec = Recommend(
            status=voting.get_status(),
            problems=problems,
            responses=rs_obj.responses,
            dependency_graph=dep_graph,
        )
        rec.update(int(question_id), bool(is_correct), category, subcategory)
        recommendations = rec.get_recommendations(top_n=top_n)

        rs_obj.responses = rs_obj.responses + [{
            "question_id": question_id,
            "is_correct":  is_correct,
            "category":    category,
            "subcategory": subcategory,
        }]
        rs_obj.recommendations = recommendations
        rs_obj.save(update_fields=["responses", "recommendations", "updated_at"])

        return Response({"recommendations": recommendations})
