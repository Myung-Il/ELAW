"""
core/views_user.py

신규 사용자 온보딩 API
- POST /api/core/goals/            목표 등록 → Gemini 커리큘럼 자동 생성
- GET  /api/core/goals/            내 목표 조회
- POST /api/core/matches/generate/ 매칭 점수 계산 및 저장
- GET  /api/core/dashboard/        내 전체 현황 조회
"""

import time
import json
import requests

from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status


# ────────────────────────────────────────
# Gemini 호출 헬퍼
# ────────────────────────────────────────
def call_gemini(user, prompt, feature):
    """Gemini API 호출 + AiLog 자동 기록"""
    from core.models import AiLog

    key = getattr(settings, "GEMINI_API_KEY", "")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={key}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }

    start = time.time()
    result_text, status_str, error_msg = "", "success", None

    try:
        resp = requests.post(url, json=body, timeout=30)
        resp.raise_for_status()
        result_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        status_str = "error"
        error_msg = str(e)[:500]

    latency_ms = int((time.time() - start) * 1000)

    AiLog.objects.create(
        user=user, feature=feature,
        prompt_tokens=len(prompt.split()),
        output_tokens=len(result_text.split()) if result_text else 0,
        latency_ms=latency_ms,
        status=status_str,
        error_message=error_msg,
    )

    return result_text if status_str == "success" else None


def parse_json_from_gemini(raw):
    """Gemini 응답에서 JSON 추출"""
    if not raw:
        return None
    try:
        clean = raw.strip()
        if "```" in clean:
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean.strip())
    except json.JSONDecodeError:
        return None


def default_curriculum(goal):
    """Gemini 실패 시 기본 커리큘럼"""
    return {
        "total_weeks": 8,
        "field": goal.field or "개발",
        "job_role": goal.job_role or "개발자",
        "weeks": [
            {"week": 1, "theme": "자료구조 기초 (스택/큐/힙)",
             "tasks": ["스택 개념 학습", "큐 구현 연습", "백준 Silver 3문제"],
             "recommended_problems": ["10828", "10845", "1927"], "estimated_hours": 8},
            {"week": 2, "theme": "그래프 탐색 (BFS/DFS)",
             "tasks": ["BFS/DFS 개념", "미로 탐색 문제", "연결 요소 문제"],
             "recommended_problems": ["1260", "2178", "11724"], "estimated_hours": 10},
            {"week": 3, "theme": "동적 프로그래밍 (DP)",
             "tasks": ["DP 개념 정리", "1D DP 문제", "2D DP 문제"],
             "recommended_problems": ["1463", "9095", "11053"], "estimated_hours": 12},
            {"week": 4, "theme": "이분탐색 & 그리디",
             "tasks": ["이분탐색 구현", "그리디 전략", "백준 Silver 문제"],
             "recommended_problems": ["1920", "2805", "11047"], "estimated_hours": 10},
            {"week": 5, "theme": f"{goal.field or '백엔드'} 기술 기초",
             "tasks": ["핵심 개념 학습", "프로젝트 설계", "코드 구현"],
             "recommended_problems": [], "estimated_hours": 14},
            {"week": 6, "theme": f"{goal.field or '백엔드'} 심화",
             "tasks": ["심화 개념 적용", "API 설계", "테스트 코드"],
             "recommended_problems": [], "estimated_hours": 14},
            {"week": 7, "theme": "프로젝트 완성",
             "tasks": ["기능 구현 마무리", "버그 수정", "배포 준비"],
             "recommended_problems": [], "estimated_hours": 14},
            {"week": 8, "theme": "포트폴리오 & 취업 준비",
             "tasks": ["GitHub 정리", "포트폴리오 작성", "자기소개서 준비"],
             "recommended_problems": [], "estimated_hours": 10},
        ],
    }


# ────────────────────────────────────────
# 목표 등록 → 커리큘럼 자동 생성
# ────────────────────────────────────────
class GoalView(APIView):
    """
    GET  /api/core/goals/  → 내 목표 조회
    POST /api/core/goals/  → 목표 등록 + Gemini 커리큘럼 자동 생성

    요청 예시:
    {
        "goal_type": "job",
        "field": "풀스택",
        "job_role": "풀스택 개발자",
        "duration_weeks": 16
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import UserGoal, Curriculum

        goals = []
        for g in request.user.goals.filter(is_active=True):
            curriculum = Curriculum.objects.filter(
                user=request.user, goal=g, is_active=True
            ).first()
            goals.append({
                "id":             g.id,
                "goal_type":      g.goal_type,
                "field":          g.field,
                "job_role":       g.job_role,
                "duration_weeks": g.duration_weeks,
                "start_date":     g.start_date.isoformat() if g.start_date else None,
                "end_date":       g.end_date.isoformat() if g.end_date else None,
                "is_active":      g.is_active,
                "has_curriculum": curriculum is not None,
                "curriculum_id":  curriculum.id if curriculum else None,
                "content_json":   curriculum.content_json if curriculum else None,
                "created_at":     g.created_at.isoformat(),
            })
        return Response(goals)

    def post(self, request):
        from core.models import UserGoal, Curriculum, LearningStats, SolveHistory
        from datetime import date, timedelta

        # ── 입력값 검증 ──────────────────────────
        goal_type      = request.data.get("goal_type", "job")
        field          = request.data.get("field", "").strip()
        job_role       = request.data.get("job_role", "").strip()
        duration_weeks = int(request.data.get("duration_weeks", 8))

        if not field or not job_role:
            return Response(
                {"error": "field(관심 분야)와 job_role(목표 직무)은 필수입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 기존 활성 목표 비활성화 ───────────────
        UserGoal.objects.filter(user=request.user, is_active=True).update(is_active=False)

        # ── 새 목표 생성 ─────────────────────────
        goal = UserGoal.objects.create(
            user           = request.user,
            goal_type      = goal_type,
            field          = field,
            job_role       = job_role,
            duration_weeks = duration_weeks,
            start_date     = date.today(),
            end_date       = date.today() + timedelta(weeks=duration_weeks),
            mid_eval_date  = date.today() + timedelta(weeks=duration_weeks // 2),
            is_active      = True,
        )

        # ── Gemini로 커리큘럼 생성 ────────────────
        solve_count = SolveHistory.objects.filter(user=request.user).count()
        tags  = list(LearningStats.objects.filter(
            user=request.user, stat_type="algo_tag"
        ).values_list("stat_key", flat=True))
        langs = list(LearningStats.objects.filter(
            user=request.user, stat_type="language"
        ).values_list("stat_key", flat=True))

        prompt = f"""당신은 취업 준비 학습 플랫폼 ELAW의 AI 커리큘럼 생성기입니다.
아래 사용자 정보를 바탕으로 {duration_weeks // 2}주 학습 커리큘럼을 JSON으로 생성해주세요.

[사용자 정보]
- 이름: {request.user.name}
- 목표 직무: {job_role}
- 관심 분야: {field}
- 주요 언어: {', '.join(langs) if langs else '미정'}
- 백준 풀이 수: {solve_count}문제
- 알고리즘 태그: {', '.join(tags) if tags else '없음'}
- 학습 기간: {duration_weeks}주

[요구사항]
- 총 {duration_weeks // 2}주 커리큘럼
- 전반부: 알고리즘/자료구조 / 후반부: {field} 기술 심화
- 각 주차: theme, tasks(3개), recommended_problems(백준 번호), estimated_hours

[JSON만 출력]
{{"total_weeks":{duration_weeks//2},"field":"{field}","job_role":"{job_role}","weeks":[{{"week":1,"theme":"","tasks":[],"recommended_problems":[],"estimated_hours":0}}]}}"""

        raw     = call_gemini(request.user, prompt, "curriculum")
        content = parse_json_from_gemini(raw) or default_curriculum(goal)

        curriculum = Curriculum.objects.create(
            user         = request.user,
            goal         = goal,
            is_active    = True,
            version      = 1,
            content_json = content,
        )

        return Response(
            {
                "message":       "목표가 등록되고 커리큘럼이 생성되었습니다.",
                "goal_id":       goal.id,
                "curriculum_id": curriculum.id,
                "field":         field,
                "job_role":      job_role,
                "duration_weeks": duration_weeks,
                "curriculum_weeks": content.get("total_weeks"),
                "ai_generated":  raw is not None,
            },
            status=status.HTTP_201_CREATED,
        )


# ────────────────────────────────────────
# 매칭 점수 계산 및 저장
# ────────────────────────────────────────
class MatchGenerateView(APIView):
    """
    POST /api/core/matches/generate/
    → 활성 공고와 매칭 점수 계산 후 DB 저장

    요청 본문 없음 (토큰으로 사용자 식별)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from core.models import JobPosting, Match, LearningStats, PlatformLink

        # 사용자 스킬 수집
        my_skills = set()

        # 언어 통계에서 스킬 추출
        for stat in LearningStats.objects.filter(user=request.user, stat_type="language"):
            my_skills.add(stat.stat_key.lower())

        # 플랫폼 연동 정보에서 스킬 추가
        platform_skills = {"python", "git"}  # 기본값
        links = PlatformLink.objects.filter(user=request.user, is_active=True)
        for link in links:
            if link.platform == "github":
                platform_skills.add("github")
            if link.platform == "baekjoon":
                platform_skills.update({"알고리즘", "자료구조"})
        my_skills.update(platform_skills)

        # 알고리즘 태그 수
        algo_count = LearningStats.objects.filter(
            user=request.user, stat_type="algo_tag"
        ).count()

        # 활성 공고 전체와 매칭
        postings = JobPosting.objects.filter(is_active=True)
        results  = []

        for posting in postings:
            req  = [s.lower() for s in (posting.required_skills  or [])]
            pref = [s.lower() for s in (posting.preferred_skills or [])]

            req_score  = (sum(1 for s in req  if s in my_skills) / len(req)  * 60) if req  else 0
            pref_score = (sum(1 for s in pref if s in my_skills) / len(pref) * 25) if pref else 0
            algo_bonus = min(algo_count * 1.5, 15)
            total      = round(min(req_score + pref_score + algo_bonus, 100), 1)

            if total >= 80:   st = "applied"
            elif total >= 65: st = "scrapped"
            elif total >= 50: st = "viewed"
            else:             st = "recommended"

            match, created = Match.objects.update_or_create(
                user=request.user, posting=posting,
                defaults=dict(match_score=total, status=st),
            )
            results.append({
                "posting_id":    posting.id,
                "posting_title": posting.title,
                "company":       posting.company.name,
                "match_score":   total,
                "status":        st,
                "created":       created,
            })

        # 점수 높은 순 정렬
        results.sort(key=lambda x: -x["match_score"])

        return Response({
            "message":       f"{len(results)}개 공고와 매칭 완료",
            "my_skills":     list(my_skills),
            "matches":       results,
        })


# ────────────────────────────────────────
# 내 전체 현황 대시보드
# ────────────────────────────────────────
class DashboardView(APIView):
    """
    GET /api/core/dashboard/
    → 사용자 전체 현황 한 번에 조회
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import (UserGoal, Curriculum, SolveHistory,
                                  LearningStats, Portfolio, Match, PlatformLink)

        user = request.user

        # 목표
        goal = UserGoal.objects.filter(user=user, is_active=True).first()

        # 커리큘럼
        curriculum = None
        if goal:
            curriculum = Curriculum.objects.filter(
                user=user, goal=goal, is_active=True
            ).first()

        # 풀이 통계
        solve_total  = SolveHistory.objects.filter(user=user).count()
        solve_solved = SolveHistory.objects.filter(user=user, status="solved").count()

        # 언어 Top3
        top_langs = list(
            LearningStats.objects.filter(user=user, stat_type="language")
            .order_by("-correct_rate")
            .values("stat_key", "correct_rate")[:3]
        )

        # 취약 태그 Top3 (정답률 낮은 순)
        weak_tags = list(
            LearningStats.objects.filter(user=user, stat_type="algo_tag")
            .order_by("correct_rate")
            .values("stat_key", "correct_rate", "total_count")[:3]
        )

        # 매칭 Top3
        top_matches = []
        for m in Match.objects.filter(user=user).select_related("posting__company").order_by("-match_score")[:3]:
            top_matches.append({
                "posting_title": m.posting.title,
                "company":       m.posting.company.name,
                "match_score":   m.match_score,
                "status":        m.status,
            })

        # 포트폴리오
        portfolio = Portfolio.objects.filter(user=user).first()

        # 플랫폼 연동
        platforms = []
        for link in PlatformLink.objects.filter(user=user, is_active=True):
            platforms.append({
                "platform":    link.platform,
                "external_id": link.external_id,
                "last_synced": link.last_synced.isoformat() if link.last_synced else None,
            })

        return Response({
            "user": {
                "name":  user.name,
                "email": user.email,
                "role":  user.role,
            },
            "goal": {
                "field":          goal.field if goal else None,
                "job_role":       goal.job_role if goal else None,
                "duration_weeks": goal.duration_weeks if goal else None,
                "has_curriculum": curriculum is not None,
            } if goal else None,
            "solve_stats": {
                "total":       solve_total,
                "solved":      solve_solved,
                "correct_rate": round(solve_solved / solve_total * 100, 1) if solve_total else 0,
            },
            "top_languages": top_langs,
            "weak_tags":     weak_tags,
            "top_matches":   top_matches,
            "portfolio":     {"id": portfolio.id, "slug": portfolio.public_slug} if portfolio else None,
            "platforms":     platforms,
        })
