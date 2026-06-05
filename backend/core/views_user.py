"""
core/views_user.py

신규 사용자 온보딩 API
- POST /api/core/goals/                목표 등록 → 기업공고 기반 커리큘럼 자동 생성 (use_ai=true 시 Gemini)
- GET  /api/core/goals/                내 목표 조회
- PATCH /api/core/curriculum/<id>/     커리큘럼 주차 수정
- POST /api/core/matches/generate/     매칭 점수 계산 및 저장
- GET  /api/core/dashboard/            내 전체 현황 조회
"""

import time
import json
import logging
import requests

logger = logging.getLogger(__name__)

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


# 주차별 기본 백준 추천 문제 (난이도 순 진행)
_DEFAULT_WEEK_PROBLEMS = [
    ["10828", "10845", "1927"],   # w1: 스택·큐·힙
    ["1260",  "2178",  "1463"],   # w2: DFS/BFS·DP
    ["1920",  "10816", "2805"],   # w3: 이분탐색
    ["11047", "1931",  "1541"],   # w4: 그리디
    ["1991",  "11725", "1167"],   # w5: 트리
    ["9663",  "2580",  "1987"],   # w6: 백트래킹
    ["1753",  "1916",  "11404"],  # w7: 최단경로
    ["1197",  "1043",  "2252"],   # w8: MST·위상정렬
]


def default_curriculum(goal, topics=None, required_skills=None, duration_weeks=8):
    """Gemini 실패 시 직무·기술 기반 동적 폴백 커리큘럼"""
    role  = goal.job_role or "개발자"
    field = goal.field    or "개발"
    weeks = []

    def _problems_for_week(w_idx: int):
        """0-indexed 주차 번호 → 추천 백준 문제 3개"""
        return _DEFAULT_WEEK_PROBLEMS[w_idx % len(_DEFAULT_WEEK_PROBLEMS)]

    # 알고리즘 기초 (1~2주)
    weeks += [
        {"week": 1, "theme": "자료구조 & 알고리즘 기초",
         "tasks": ["스택/큐/힙 구현 연습", f"{role} 코딩테스트 유형 파악", "백준 Silver 3문제 풀이"],
         "recommended_problems": _problems_for_week(0), "estimated_hours": 8},
        {"week": 2, "theme": "그래프 탐색 & DP",
         "tasks": ["BFS/DFS 패턴 학습", "DP 핵심 유형 정리", f"{role} 빈출 알고리즘 문제"],
         "recommended_problems": _problems_for_week(1), "estimated_hours": 10},
    ]

    # 선택 topics 또는 required_skills 기반 기술 주차 생성
    tech_items = []
    if topics:
        tech_items.extend(topics)
    if required_skills:
        tech_items.extend(s for s in required_skills if s not in tech_items)

    tech_weeks = duration_weeks - 4  # 마지막 2주는 프로젝트·포트폴리오
    if not tech_items:
        tech_items = [f"{field} 핵심 기술", f"{role} 실전 기술"]

    for i, tech in enumerate(tech_items[:max(tech_weeks, 1)], start=3):
        weeks.append({
            "week": i,
            "theme": f"{tech} 학습 및 실습",
            "tasks": [f"{tech} 핵심 개념 정리", f"{tech} 실전 예제 구현", "관련 오픈소스 코드 분석"],
            "recommended_problems": _problems_for_week(i - 1),
            "estimated_hours": 12,
        })

    # 부족한 주차 채우기
    filled = len(weeks)
    if filled < duration_weeks - 2:
        weeks.append({
            "week": filled + 1,
            "theme": f"{role} 실전 프로젝트 설계",
            "tasks": [f"{role} 포트폴리오용 프로젝트 기획", "기술 스택 확정 및 환경 구성", "핵심 기능 구현 시작"],
            "recommended_problems": _problems_for_week(filled),
            "estimated_hours": 14,
        })

    # 마지막 2주: 프로젝트 완성 + 포트폴리오
    cur_week = len(weeks) + 1
    weeks.append({
        "week": cur_week,
        "theme": "프로젝트 완성 & 코드 리뷰",
        "tasks": ["핵심 기능 마무리", "코드 품질 개선 (리팩토링)", "README 작성 및 배포"],
        "recommended_problems": _problems_for_week(cur_week - 1),
        "estimated_hours": 14,
    })
    weeks.append({
        "week": cur_week + 1,
        "theme": "포트폴리오 & 면접 준비",
        "tasks": ["GitHub 프로필 정리", f"{role} 기술 면접 예상 질문 정리", "ELAW AI 포트폴리오 초안 생성"],
        "recommended_problems": _problems_for_week(cur_week),
        "estimated_hours": 10,
    })

    final_weeks = weeks[:duration_weeks]
    return {
        "total_weeks": duration_weeks,
        "field": field,
        "job_role": role,
        "weeks": final_weeks,
    }


# ────────────────────────────────────────
# 기업공고 기반 커리큘럼 생성 (기본 경로 — Gemini 미사용)
# ────────────────────────────────────────

# 온보딩 한글 직무명 → JobPosting DB 직무명 매핑
_POSTING_ROLE_MAP = {
    "백엔드 개발자":            "Backend Engineer",
    "프론트엔드 개발자":        "Frontend Developer",
    "풀스택 개발자":            "Full Stack Engineer",
    "데이터 사이언티스트":      "Data Scientist",
    "데이터 사이언스":          "Data Scientist",
    "데이터 과학자":            "Data Scientist",
    "AI/ML 엔지니어":           "AI Engineer",
    "AI 엔지니어":              "AI Engineer",
    "ML 엔지니어":              "Machine Learning Researcher",
    "머신러닝":                 "Machine Learning Researcher",
    "DevOps/클라우드 엔지니어": "DevOps Engineer",
    "DevOps":                   "DevOps Engineer",
    "클라우드 인프라":          "Cloud Infrastructure Engineer",
    "모바일 개발자":            "Mobile App Developer",
    "보안 엔지니어":            "Security Engineer",
    "네트워크/보안":            "Security Engineer",
    "소프트웨어 개발":          "Software Engineer",
    "게임 개발자":              "Game Developer",
    "임베디드 시스템":          "Embedded Systems Engineer",
    "컴퓨터 비전":              "Computer Vision Engineer",
    "QA 엔지니어":              "Quality Assurance Engineer (QA)",
    "SRE":                      "Site Reliability Engineer (SRE)",
}


def resolve_posting_job_role(job_role: str):
    """한글 목표 직무명 → JobPosting.job_role 해석 (매칭 실패 시 None)"""
    from core.models import JobPosting

    if not job_role:
        return None
    # 1. 정확히 일치
    if JobPosting.objects.filter(job_role=job_role, is_active=True).exists():
        return job_role
    # 2. 딕셔너리 매핑
    mapped = _POSTING_ROLE_MAP.get(job_role)
    if mapped and JobPosting.objects.filter(job_role=mapped, is_active=True).exists():
        return mapped
    # 3. 부분 문자열 대소문자 무시 매칭
    roles = (
        JobPosting.objects.filter(is_active=True)
        .exclude(job_role__isnull=True)
        .values_list("job_role", flat=True)
        .distinct()
    )
    low = job_role.lower()
    for role in roles:
        if low in role.lower() or role.lower() in low:
            return role
    return None


def posting_based_curriculum(goal, topics=None, required_skills=None, duration_weeks=8):
    """
    기업공고(JobPosting) 기반 커리큘럼 생성 — JobStudyView의 공고 맞춤 로직을 모방.

    사용자가 온보딩에서 선택한 분야(field)·직무(job_role)에 해당하는 활성 공고들의
    필수/우대 기술을 빈도순으로 집계해 주차 테마로 사용한다.
    배치 원칙은 JobStudyView와 동일: 필수 기술 먼저, 우대 기술은 중반 이후.
    """
    from collections import Counter
    from core.models import JobPosting

    resolved_role = resolve_posting_job_role(goal.job_role)

    req_counter, pref_counter = Counter(), Counter()
    if resolved_role:
        postings = JobPosting.objects.filter(job_role=resolved_role, is_active=True)
        for req, pref in postings.values_list("required_skills", "preferred_skills"):
            req_counter.update(s for s in (req or []) if s)
            pref_counter.update(s for s in (pref or []) if s)

    # 요청에서 직접 넘어온 필수 스킬 → 공고 필수 기술(빈도순) → 공고 우대 기술(빈도순)
    skills = list(required_skills or [])
    skills += [s for s, _ in req_counter.most_common() if s not in skills]
    skills += [s for s, _ in pref_counter.most_common() if s not in skills]

    content = default_curriculum(
        goal,
        topics=topics,              # 사용자가 선택한 집중 학습 주제를 최우선 배치
        required_skills=skills,
        duration_weeks=duration_weeks,
    )
    content["source"] = "job_postings" if resolved_role else "default"
    content["source_job_role"] = resolved_role
    return content


# ────────────────────────────────────────
# 목표 등록 → 커리큘럼 자동 생성
# ────────────────────────────────────────
class GoalView(APIView):
    """
    GET  /api/core/goals/  → 내 목표 조회
    POST /api/core/goals/  → 목표 등록 + 커리큘럼 자동 생성

    커리큘럼은 기본적으로 사용자가 선택한 분야·직무에 해당하는
    기업공고(JobPosting)의 필수/우대 기술을 집계해 생성한다 (Gemini 미사용).
    "use_ai": true 를 함께 보내면 Gemini 생성을 시도하고, 실패 시 공고 기반으로 폴백한다.

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
                "created_at":     g.created_at.isoformat(),
            })
        return Response(goals)

    def post(self, request):
        from core.models import UserGoal, Curriculum
        from datetime import date, timedelta

        # ── 입력값 검증 ──────────────────────────
        goal_type       = request.data.get("goal_type", "job")
        field           = request.data.get("field", "").strip()
        job_role        = request.data.get("job_role", "").strip()
        duration_weeks  = int(request.data.get("duration_weeks", 8))
        topics          = [t.strip() for t in request.data.get("topics", []) if t.strip()]
        required_skills = [str(s).strip() for s in request.data.get("required_skills", []) if s and str(s).strip()]

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

        # ── 커리큘럼 생성 ────────────────────────
        # 기본: 기업공고(JobPosting) 기반 생성 — Gemini 미사용.
        # 요청에 use_ai=true 를 명시한 경우에만 Gemini를 시도하고,
        # 실패하면 동일하게 공고 기반으로 폴백한다.
        use_ai = str(request.data.get("use_ai", "")).lower() in ("1", "true", "yes")

        raw, parsed = None, None
        if use_ai:
            raw, parsed = self._generate_with_gemini(
                request.user, field, job_role, topics, duration_weeks
            )
            if not parsed:
                logger.warning(
                    "Gemini 커리큘럼 생성 실패 — 공고 기반 커리큘럼으로 대체 (user_id=%s)",
                    request.user.id,
                )

        content = parsed or posting_based_curriculum(
            goal,
            topics=topics,
            required_skills=required_skills,
            duration_weeks=duration_weeks,
        )

        curriculum = Curriculum.objects.create(
            user         = request.user,
            goal         = goal,
            is_active    = True,
            version      = 1,
            content_json = content,
        )

        # ── 매칭 점수 자동 계산 ──────────────────
        # 신규 사용자도 목표 설정 직후 공고 목록에서 매칭 점수를 바로 볼 수 있게 한다.
        # 매칭 실패가 목표 생성 자체를 막아서는 안 되므로 예외는 로그만 남긴다.
        try:
            generate_matches_for_user(request.user)
        except Exception:
            logger.exception("목표 생성 후 매칭 점수 자동 계산 실패 (user_id=%s)", request.user.id)

        return Response(
            {
                "message":       "목표가 등록되고 커리큘럼이 생성되었습니다.",
                "goal_id":       goal.id,
                "curriculum_id": curriculum.id,
                "field":         field,
                "job_role":      job_role,
                "duration_weeks": duration_weeks,
                "curriculum_weeks": content.get("total_weeks"),
                "curriculum_source": content.get("source", "gemini" if parsed else None),
                "ai_generated":  parsed is not None,
            },
            status=status.HTTP_201_CREATED,
        )

    def _generate_with_gemini(self, user, field, job_role, topics, duration_weeks):
        """use_ai=true 요청 시에만 호출되는 Gemini 커리큘럼 생성 (선택 기능)"""
        from core.models import LearningStats, SolveHistory

        solve_count = SolveHistory.objects.filter(user=user).count()
        _stats = list(
            LearningStats.objects.filter(
                user=user, stat_type__in=["algo_tag", "language"]
            ).values_list("stat_type", "stat_key")
        )
        tags  = [k for t, k in _stats if t == "algo_tag"]
        langs = [k for t, k in _stats if t == "language"]

        topics_str = ', '.join(topics) if topics else '없음 (직무 기반으로 결정)'
        langs_str  = ', '.join(langs)  if langs  else '미정'
        tags_str   = ', '.join(tags[:10]) if tags else '없음'

        prompt = f"""당신은 취업 준비 학습 플랫폼 ELAW의 AI 커리큘럼 생성기입니다.
아래 사용자 정보를 바탕으로 {duration_weeks}주 맞춤 학습 커리큘럼을 JSON으로 생성해주세요.

[사용자 정보]
- 목표 직무: {job_role}
- 관심 분야: {field}
- 집중 학습 주제 (사용자 선택): {topics_str}
- 보유 언어 경험: {langs_str}
- 알고리즘 풀이 수: {solve_count}문제 (백준 기준)
- 약한 알고리즘 태그: {tags_str}
- 학습 기간: {duration_weeks}주

[커리큘럼 생성 원칙 — 반드시 준수]
1. "{job_role}" 취업에 직접 필요한 기술 중심으로 전체 커리큘럼 구성
2. 사용자가 선택한 집중 학습 주제 [{topics_str}]를 각 주차 테마에 반드시 반영
3. 주차별 theme은 "{job_role}"에 특화된 구체적인 기술 키워드로 작성 (예: "Django REST API 설계", "React 상태 관리 패턴")
4. 앞 1~2주는 {job_role} 코딩테스트에서 자주 출제되는 알고리즘 위주
5. 중반부는 선택 주제 및 직무 핵심 기술 학습
6. 마지막 1~2주는 실전 프로젝트 완성 및 포트폴리오 정리
7. estimated_hours는 주차별 난이도에 따라 8~16 범위에서 현실적으로 설정
8. recommended_problems는 해당 주차 주제와 관련된 실제 백준 문제 번호 (알고리즘 주차만)

[JSON만 출력 — 코드블록·설명 텍스트 없이 순수 JSON]
{{"total_weeks":{duration_weeks},"field":"{field}","job_role":"{job_role}","weeks":[{{"week":1,"theme":"구체적 주제명","tasks":["과제1","과제2","과제3"],"recommended_problems":["문제번호"],"estimated_hours":10}}]}}"""

        raw    = call_gemini(user, prompt, "curriculum")
        parsed = parse_json_from_gemini(raw)
        return raw, parsed


# ────────────────────────────────────────
# 매칭 점수 계산 및 저장
# ────────────────────────────────────────
def generate_matches_for_user(user):
    """활성 공고 전체와 매칭 점수를 계산해 Match 테이블에 저장.

    MatchGenerateView(수동 재계산)와 GoalView(목표 생성 직후 자동 계산)에서 공용.
    반환: (my_skills 리스트, 점수 내림차순 results 리스트)
    """
    from core.models import JobPosting, Match, LearningStats, PlatformLink

    # 사용자 스킬 수집 — 언어·알고리즘 태그를 단일 쿼리로 가져오기
    my_skills = set()
    _all_stats = list(
        LearningStats.objects.filter(
            user=user, stat_type__in=["language", "algo_tag"]
        ).values_list("stat_type", "stat_key")
    )
    for stat_type, stat_key in _all_stats:
        if stat_type == "language":
            my_skills.add(stat_key.lower())
    algo_count = sum(1 for t, _ in _all_stats if t == "algo_tag")

    # 플랫폼 연동 정보에서 스킬 추가
    platform_skills = {"python", "git"}  # 기본값
    links = PlatformLink.objects.filter(user=user, is_active=True)
    for link in links:
        if link.platform == "github":
            platform_skills.add("github")
        if link.platform == "baekjoon":
            platform_skills.update({"알고리즘", "자료구조"})
    my_skills.update(platform_skills)

    # 활성 공고 전체와 매칭 — company N+1 방지
    # Match 저장은 bulk_create/bulk_update로 일괄 처리한다.
    # (공고당 update_or_create는 원격 Supabase 기준 왕복 2~3회 × 공고 수 ≈ 50초+
    #  → Vercel 프록시 ~75초 한도를 넘겨 502를 유발했던 원인)
    # ⚠️ 필요한 컬럼만 values()로 조회할 것 — 전체 컬럼 조회(description 포함)는
    #   응답이 수 MB라 원격 DB 구간에서 간헐적 ~60초 전송 스톨을 유발했다 (실측, 2026-06-05).
    postings = JobPosting.objects.filter(is_active=True).values(
        "id", "title", "required_skills", "preferred_skills", "company__name"
    )
    existing = {m.posting_id: m for m in Match.objects.filter(user=user)}
    results, to_create, to_update = [], [], []
    now = timezone.now()

    for posting in postings:
        req  = [s.lower() for s in (posting["required_skills"]  or [])]
        pref = [s.lower() for s in (posting["preferred_skills"] or [])]

        req_score  = (sum(1 for s in req  if s in my_skills) / len(req)  * 60) if req  else 0
        pref_score = (sum(1 for s in pref if s in my_skills) / len(pref) * 25) if pref else 0
        algo_bonus = min(algo_count * 1.5, 15)
        total      = round(min(req_score + pref_score + algo_bonus, 100), 1)

        if total >= 80:   st = "applied"
        elif total >= 65: st = "scrapped"
        elif total >= 50: st = "viewed"
        else:             st = "recommended"

        match = existing.get(posting["id"])
        created = match is None
        if created:
            to_create.append(Match(user=user, posting_id=posting["id"], match_score=total, status=st))
        elif match.match_score != total or match.status != st:
            match.match_score = total
            match.status      = st
            match.updated_at  = now  # bulk_update는 auto_now를 적용하지 않음
            to_update.append(match)
        results.append({
            "posting_id":    posting["id"],
            "posting_title": posting["title"],
            "company":       posting["company__name"],
            "match_score":   total,
            "status":        st,
            "created":       created,
        })

    if to_create:
        Match.objects.bulk_create(to_create)
    if to_update:
        Match.objects.bulk_update(to_update, ["match_score", "status", "updated_at"])

    # 점수 높은 순 정렬
    results.sort(key=lambda x: -x["match_score"])
    return list(my_skills), results


class MatchGenerateView(APIView):
    """
    POST /api/core/matches/generate/
    → 활성 공고와 매칭 점수 계산 후 DB 저장

    요청 본문 없음 (토큰으로 사용자 식별)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        my_skills, results = generate_matches_for_user(request.user)

        return Response({
            "message":       f"{len(results)}개 공고와 매칭 완료",
            "my_skills":     my_skills,
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


# ────────────────────────────────────────
# 직무별 학습 문제 목록
# ────────────────────────────────────────
class JobProblemsView(APIView):
    """
    GET /api/core/problems/

    활성 목표 직무에 해당하는 JobProblem 목록 반환.
    Query params:
      - job_role   : 직무명 (선택, 미입력 시 활성 목표 job_role 사용)
      - category   : 카테고리 필터
      - difficulty : university_level | junior_level | middle_level | senior_level
      - limit      : 1~50 (기본 20)
      - offset     : 0+
    """
    permission_classes = [IsAuthenticated]

    # 한글 목표 직무명 → JobProblem DB 직무명 매핑
    ROLE_MAP = {
        "소프트웨어 개발": "Software Engineer",
        "백엔드 개발자":   "Backend Engineer",
        "프론트엔드 개발자": "Frontend Developer",
        "풀스택 개발자":   "Full Stack Engineer",
        "AI 엔지니어":    "AI Engineer",
        "데이터 사이언스": "Data Scientist",
        "데이터 과학자":   "Data Scientist",
        "임베디드 시스템": "Embedded Systems Engineer",
        "네트워크/보안":   "Security Engineer",
        "보안 엔지니어":   "Security Engineer",
        "기계/로봇":      "Robotics Engineer",
        "머신러닝":       "Machine Learning Researcher",
        "ML 엔지니어":    "Machine Learning Researcher",
        "컴퓨터 비전":    "Computer Vision Engineer",
        "클라우드 인프라": "Cloud Infrastructure Engineer",
        "게임 개발자":    "Game Developer",
        "모바일 개발자":  "Mobile App Developer",
        "QA 엔지니어":   "Quality Assurance Engineer (QA)",
        "SRE":           "Site Reliability Engineer (SRE)",
        "DevOps":        "DevOps Engineer",
    }

    def _resolve_job_role(self, goal_job_role: str) -> str:
        from core.models_problems import JobProblem
        # 1. 정확히 일치
        if JobProblem.objects.filter(job_role=goal_job_role).exists():
            return goal_job_role
        # 2. 딕셔너리 매핑
        if goal_job_role in self.ROLE_MAP:
            return self.ROLE_MAP[goal_job_role]
        # 3. 부분 문자열 대소문자 무시 매칭
        roles = list(JobProblem.objects.values_list("job_role", flat=True).distinct())
        for role in roles:
            if goal_job_role.lower() in role.lower() or role.lower() in goal_job_role.lower():
                return role
        return "Software Engineer"

    def get(self, request):
        from core.models import UserGoal
        from core.models_problems import JobProblem

        # ── 직무 결정 ─────────────────────────────
        job_role_param = request.query_params.get("job_role", "").strip()
        if job_role_param:
            resolved_role = self._resolve_job_role(job_role_param)
        else:
            active_goal = UserGoal.objects.filter(user=request.user, is_active=True).first()
            if not active_goal:
                return Response({
                    "message": "활성 목표가 없습니다. 목표를 먼저 설정해주세요.",
                    "job_role": None, "total": 0, "categories": [], "data": [],
                })
            resolved_role = self._resolve_job_role(active_goal.job_role)

        qs = JobProblem.objects.filter(job_role=resolved_role)

        # ── 카테고리·난이도 필터 ──────────────────
        category = request.query_params.get("category", "").strip()
        if category:
            qs = qs.filter(category=category)

        difficulty = request.query_params.get("difficulty", "").strip()
        if difficulty:
            qs = qs.filter(difficulty=difficulty)

        # ── 해당 직무 전체 카테고리 목록 ─────────
        all_categories = list(
            JobProblem.objects.filter(job_role=resolved_role)
            .values_list("category", flat=True)
            .distinct()
            .order_by("category")
        )

        # ── 페이지네이션 ──────────────────────────
        total = qs.count()
        try:
            limit  = max(1, min(int(request.query_params.get("limit",  20)), 50))
            offset = max(0, int(request.query_params.get("offset", 0)))
        except (ValueError, TypeError):
            limit, offset = 20, 0

        page_qs = qs.order_by("original_question_id")[offset: offset + limit]

        data = [
            {
                "id":                   p.id,
                "original_question_id": p.original_question_id,
                "difficulty":           p.difficulty,
                "question_type":        p.question_type,
                "category":             p.category,
                "subcategory":          p.subcategory,
                "skills_required":      p.skills_required,
                "scenario":             p.scenario,
                "question":             p.question,
                "choices":              p.choices,
                "correct_answer":       p.correct_answer,
                "explanation":          p.explanation,
            }
            for p in page_qs
        ]

        return Response({
            "job_role":   resolved_role,
            "total":      total,
            "categories": all_categories,
            "limit":      limit,
            "offset":     offset,
            "has_next":   offset + limit < total,
            "data":       data,
        })


# ────────────────────────────────────────
# 커리큘럼 주차 수정
# ────────────────────────────────────────

class CurriculumUpdateView(APIView):
    """PATCH /api/core/curriculum/<id>/  — 주차 내용(weeks) 업데이트"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, curriculum_id):
        from core.models import Curriculum

        try:
            curriculum = Curriculum.objects.get(id=curriculum_id, user=request.user)
        except Curriculum.DoesNotExist:
            return Response(
                {"error": "커리큘럼을 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        weeks = request.data.get("weeks")
        if weeks is None:
            return Response(
                {"error": "weeks 필드가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = curriculum.content_json or {}
        content["weeks"] = weeks
        curriculum.content_json = content
        curriculum.save(update_fields=["content_json"])

        return Response(
            {"message": "커리큘럼이 저장되었습니다.", "id": curriculum.id},
            status=status.HTTP_200_OK,
        )
