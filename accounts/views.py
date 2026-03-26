"""
accounts/views.py
- 회원가입 (기존)
- 플랫폼 연동 등록: POST /api/accounts/platform/
- 플랫폼 동기화:   POST /api/accounts/platform/sync/
- 연동 현황 조회:  GET  /api/accounts/platform/
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .serializers import UserSerializer, PlatformLinkSerializer


# ─────────────────────────────────────────
# 기존: 회원가입
# ─────────────────────────────────────────

class SignupView(APIView):
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "회원가입이 성공적으로 완료되었습니다."},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────
# 신규: 플랫폼 연동
# ─────────────────────────────────────────

class PlatformLinkView(APIView):
    """
    GET  /api/accounts/platform/  → 내 연동 현황 조회
    POST /api/accounts/platform/  → 플랫폼 아이디 등록/수정
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """연동된 플랫폼 목록 반환"""
        from core.models import PlatformLink
        links = PlatformLink.objects.filter(user=request.user)
        serializer = PlatformLinkSerializer(links, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        플랫폼 아이디 등록 또는 수정.

        요청 예시:
        {
            "platform": "baekjoon",    // "baekjoon" | "github" | "programmers"
            "external_id": "my_handle",
            "access_token": "ghp_xxxx"  // GitHub PAT (선택)
        }
        """
        from core.models import PlatformLink

        platform    = request.data.get("platform")
        external_id = request.data.get("external_id", "").strip()
        access_token = request.data.get("access_token", None)

        # 유효성 검사
        allowed_platforms = ["baekjoon", "github", "programmers"]
        if platform not in allowed_platforms:
            return Response(
                {"error": f"platform은 {allowed_platforms} 중 하나여야 합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not external_id:
            return Response(
                {"error": "external_id(아이디)를 입력해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 등록 또는 업데이트
        link, created = PlatformLink.objects.update_or_create(
            user     = request.user,
            platform = platform,
            defaults = {
                "external_id":  external_id,
                "access_token": access_token,
                "is_active":    True,
            }
        )

        action = "등록" if created else "수정"
        return Response(
            {
                "message":     f"{platform} 아이디가 {action}되었습니다.",
                "platform":    platform,
                "external_id": external_id,
                "created":     created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PlatformSyncView(APIView):
    """
    POST /api/accounts/platform/sync/
    → 등록된 플랫폼에서 실제 데이터 수집

    요청 예시:
    {
        "platform": "baekjoon"   // 생략 시 연동된 전체 플랫폼 동기화
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from core.models import PlatformLink
        from core.etl.baekjoon_collector import BaekjoonCollector
        from core.etl.github_collector import GitHubCollector

        target_platform = request.data.get("platform", None)  # None = 전체

        # 동기화할 플랫폼 링크 조회
        qs = PlatformLink.objects.filter(user=request.user, is_active=True)
        if target_platform:
            qs = qs.filter(platform=target_platform)

        if not qs.exists():
            return Response(
                {"error": "연동된 플랫폼이 없습니다. 먼저 /api/accounts/platform/ 에서 등록해주세요."},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = {}
        for link in qs:
            platform = link.platform

            if platform == "baekjoon":
                collector = BaekjoonCollector(request.user, link)
                results[platform] = collector.sync()

            elif platform == "github":
                collector = GitHubCollector(request.user, link)
                results[platform] = collector.sync()

            else:
                results[platform] = {"message": f"{platform} 수집기는 아직 준비 중입니다."}

        return Response(
            {
                "message": "동기화가 완료되었습니다.",
                "results": results,
            },
            status=status.HTTP_200_OK,
        )


class PlatformStatusView(APIView):
    """
    GET /api/accounts/platform/status/
    → 플랫폼별 수집 현황 요약 (마지막 동기화 시각, 풀이 수 등)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import PlatformLink, SolveHistory, LearningStats

        links = PlatformLink.objects.filter(user=request.user)
        summary = []

        for link in links:
            solve_count = SolveHistory.objects.filter(
                user     = request.user,
                platform = link.platform,
            ).count()

            summary.append({
                "platform":    link.platform,
                "external_id": link.external_id,
                "last_synced": link.last_synced,
                "solve_count": solve_count,
                "is_active":   link.is_active,
            })

        # 언어 통계 요약
        lang_stats = list(
            LearningStats.objects.filter(
                user      = request.user,
                stat_type = "language",
            ).values("stat_key", "correct_rate").order_by("-correct_rate")[:5]
        )

        # 알고리즘 태그 취약점 Top5 (정답률 낮은 순)
        weak_tags = list(
            LearningStats.objects.filter(
                user      = request.user,
                stat_type = "algo_tag",
            ).values("stat_key", "correct_rate", "total_count")
            .order_by("correct_rate")[:5]
        )

        return Response({
            "platforms":  summary,
            "top_languages": lang_stats,
            "weak_tags":  weak_tags,
        })
