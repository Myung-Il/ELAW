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

# 프로젝트 루트 + models/curriculum 을 sys.path에 추가
# recommend.py가 'from ml.gkt import GKT' 형태로 임포트하므로 curriculum 디렉터리도 필요
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_CURRICULUM_ROOT = os.path.join(_PROJECT_ROOT, "models", "curriculum")
for _p in (_PROJECT_ROOT, _CURRICULUM_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from collections import deque

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models_problems import JobProblem, ProblemEdge, LearningPathMeta
from .models import UserGoal
from .models_new import ProblemRecommendation

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
            "Preceding_ID":   e.source_problem.original_question_id,
            "Target_ID":      e.target_problem.original_question_id,
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


SESSION_KEY = "quiz_session"
RECOMMEND_KEY = "recommend_session"


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
            job_role = goal.job_role

        problems = _build_problems_dict(job_role)
        if not problems:
            return Response(
                {"error": f"'{job_role}' 직군의 문제 데이터가 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        ordered_path = _build_ordered_path(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        request.session[SESSION_KEY] = {
            "session": quiz.export_session(),
            "job_role": job_role,
        }
        request.session.modified = True

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

        stored = request.session.get(SESSION_KEY)
        if not stored:
            return Response({"error": "퀴즈 세션이 없습니다. /quiz/start/ 를 먼저 호출하세요."}, status=400)

        index = request.data.get("index")
        answer = request.data.get("answer", "")
        if index is None:
            return Response({"error": "index 필드가 필요합니다."}, status=400)

        job_role = stored["job_role"]
        problems = _build_problems_dict(job_role)
        ordered_path = _build_ordered_path(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(stored["session"])

        result = quiz.submit(int(index), answer)

        stored["session"] = quiz.export_session()
        request.session[SESSION_KEY] = stored
        request.session.modified = True

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
        stored = request.session.get(SESSION_KEY)
        if not stored:
            return Response({"error": "퀴즈 세션이 없습니다."}, status=400)

        if not ML_AVAILABLE:
            return Response({"error": "ML 모듈 사용 불가"}, status=503)

        job_role = stored["job_role"]
        problems = _build_problems_dict(job_role)
        ordered_path = _build_ordered_path(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(stored["session"])

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

        stored = request.session.get(SESSION_KEY)
        if not stored:
            return Response({"error": "퀴즈 세션이 없습니다."}, status=400)

        job_role = stored["job_role"]
        problems = _build_problems_dict(job_role)
        ordered_path = _build_ordered_path(job_role)
        dep_graph = _build_dependency_graph(job_role)

        quiz = SeedQuiz(str(request.user.id), problems, ordered_path)
        quiz.import_session(stored["session"])
        quiz_result = quiz.get_result()

        voting = Voting(quiz_result)
        rec = Recommend(
            status=voting.get_status(),
            problems=problems,
            responses=quiz_result["responses"],
            dependency_graph=dep_graph,
        )
        recommendations = rec.get_recommendations(top_n=5)

        request.session[RECOMMEND_KEY] = {
            "job_role": job_role,
            "responses": quiz_result["responses"],
            "zone": voting.get_zone(),
            "weights": voting.get_weights(),
        }
        request.session.modified = True

        # 추천 결과 DB 저장 (기존 pending 레코드 교체)
        ProblemRecommendation.objects.filter(
            user=request.user,
            platform=ProblemRecommendation.Platform.ELAW,
            posting__isnull=True,
            status=ProblemRecommendation.Status.PENDING,
        ).delete()
        ProblemRecommendation.objects.bulk_create([
            ProblemRecommendation(
                user=request.user,
                platform=ProblemRecommendation.Platform.ELAW,
                problem_id=str(r["question_id"]),
                posting=None,
                title=(r.get("question") or "")[:300],
                algo_tags=[r.get("category"), r.get("subcategory")],
                difficulty=r.get("difficulty", ""),
                relevance_score=r["scores"]["total"],
                reason=(
                    f"GKT:{r['scores']['GKT']:.3f} "
                    f"SAKT:{r['scores']['SAKT']:.3f} "
                    f"DKT:{r['scores']['DKT']:.3f}"
                ),
                status=ProblemRecommendation.Status.PENDING,
            )
            for r in recommendations
        ])

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

        stored = request.session.get(RECOMMEND_KEY)
        if not stored:
            return Response({"error": "추천 세션이 없습니다. /quiz/complete/ 를 먼저 호출하세요."}, status=400)

        question_id  = request.data.get("question_id")
        is_correct   = request.data.get("is_correct", False)
        category     = request.data.get("category", "")
        subcategory  = request.data.get("subcategory", "")
        top_n        = int(request.data.get("top_n", 5))

        job_role = stored["job_role"]
        problems = _build_problems_dict(job_role)
        dep_graph = _build_dependency_graph(job_role)

        # Voting 재초기화
        mock_result = {
            "accuracy": 0,
            "responses": stored["responses"],
        }
        voting = Voting(mock_result)
        voting.update(is_correct)

        rec = Recommend(
            status=voting.get_status(),
            problems=problems,
            responses=stored["responses"],
            dependency_graph=dep_graph,
        )
        rec.update(int(question_id), bool(is_correct), category, subcategory)
        recommendations = rec.get_recommendations(top_n=top_n)

        stored["responses"].append({
            "question_id": question_id,
            "is_correct": is_correct,
            "category": category,
            "subcategory": subcategory,
        })
        request.session[RECOMMEND_KEY] = stored
        request.session.modified = True

        # 풀이한 문제 상태 업데이트
        new_status = (ProblemRecommendation.Status.SOLVED if is_correct
                      else ProblemRecommendation.Status.SKIPPED)
        ProblemRecommendation.objects.filter(
            user=request.user,
            platform=ProblemRecommendation.Platform.ELAW,
            problem_id=str(question_id),
            posting__isnull=True,
        ).update(status=new_status)

        # 새 추천 목록 저장 (pending 레코드만 교체)
        ProblemRecommendation.objects.filter(
            user=request.user,
            platform=ProblemRecommendation.Platform.ELAW,
            posting__isnull=True,
            status=ProblemRecommendation.Status.PENDING,
        ).delete()
        ProblemRecommendation.objects.bulk_create([
            ProblemRecommendation(
                user=request.user,
                platform=ProblemRecommendation.Platform.ELAW,
                problem_id=str(r["question_id"]),
                posting=None,
                title=(r.get("question") or "")[:300],
                algo_tags=[r.get("category"), r.get("subcategory")],
                difficulty=r.get("difficulty", ""),
                relevance_score=r["scores"]["total"],
                reason=(
                    f"GKT:{r['scores']['GKT']:.3f} "
                    f"SAKT:{r['scores']['SAKT']:.3f} "
                    f"DKT:{r['scores']['DKT']:.3f}"
                ),
                status=ProblemRecommendation.Status.PENDING,
            )
            for r in recommendations
        ])

        return Response({"recommendations": recommendations})
