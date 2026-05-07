"""
board/views.py
공지사항/대회/이벤트 게시판 API

권한 정책:
- 조회 (GET): 누구나 (비로그인 가능)
- 작성/수정/삭제 (POST/PUT/DELETE): 관리자(is_staff=True)만
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from core.models import Post
from .serializers import (
    PostListSerializer,
    PostDetailSerializer,
    PostCreateUpdateSerializer,
)


# ─────────────────────────────────────────
# 헬퍼: 관리자 권한 체크
# ─────────────────────────────────────────

def check_admin(user):
    """관리자(is_staff=True)가 아니면 PermissionDenied 발생"""
    if not user or not user.is_authenticated:
        raise PermissionDenied("로그인이 필요합니다.")
    if not user.is_staff:
        raise PermissionDenied("관리자만 가능한 작업입니다.")


# ─────────────────────────────────────────
# 게시글 목록 / 작성
# ─────────────────────────────────────────

class BoardListView(APIView):
    """
    GET  /api/board/   → 게시글 목록 (누구나)
    POST /api/board/   → 새 게시글 작성 (관리자만)
    """

    def get_permissions(self):
        """메서드별 권한 분리"""
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        """게시글 목록 조회 - 핀 고정 → 최신순"""
        # 카테고리 필터 (선택)
        category = request.query_params.get('category', None)

        qs = Post.objects.select_related('author').all()
        if category:
            qs = qs.filter(category=category)

        # 핀 고정 → 최신순
        qs = qs.order_by('-is_pinned', '-created_at')

        serializer = PostListSerializer(qs, many=True)
        return Response({
            "message": "게시글 목록 조회 성공",
            "count": qs.count(),
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        """새 게시글 작성 (관리자 전용)"""
        check_admin(request.user)

        serializer = PostCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            # 작성자는 현재 로그인한 관리자로 자동 설정
            post = serializer.save(author=request.user)

            return Response({
                "message": "게시글 작성 성공",
                "data": PostDetailSerializer(post).data,
            }, status=status.HTTP_201_CREATED)

        return Response({
            "message": "입력값이 올바르지 않습니다.",
            "errors": serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────
# 게시글 상세 / 수정 / 삭제
# ─────────────────────────────────────────

class BoardDetailView(APIView):
    """
    GET    /api/board/<id>/   → 상세 조회 (누구나, 조회수 +1)
    PUT    /api/board/<id>/   → 수정 (관리자만)
    DELETE /api/board/<id>/   → 삭제 (관리자만)
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_object(self, post_id):
        """게시글 객체 가져오기 (없으면 None)"""
        try:
            return Post.objects.select_related('author').get(id=post_id)
        except Post.DoesNotExist:
            return None

    def get(self, request, post_id):
        """게시글 상세 조회 + 조회수 증가"""
        post = self.get_object(post_id)
        if not post:
            return Response({
                "message": "해당 게시글을 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        # 조회수 1 증가 (DB에서 직접 +1)
        Post.objects.filter(id=post_id).update(view_count=post.view_count + 1)
        post.view_count += 1  # 응답에 반영

        serializer = PostDetailSerializer(post)
        return Response({
            "message": f"{post_id}번 게시글 상세 조회 성공",
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    def put(self, request, post_id):
        """게시글 수정 (관리자 전용)"""
        check_admin(request.user)

        post = self.get_object(post_id)
        if not post:
            return Response({
                "message": "해당 게시글을 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        # partial=True → 일부 필드만 수정 가능
        serializer = PostCreateUpdateSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            updated_post = serializer.save()
            return Response({
                "message": f"{post_id}번 게시글 수정 완료",
                "data": PostDetailSerializer(updated_post).data,
            }, status=status.HTTP_200_OK)

        return Response({
            "message": "입력값이 올바르지 않습니다.",
            "errors": serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, post_id):
        """게시글 삭제 (관리자 전용)"""
        check_admin(request.user)

        post = self.get_object(post_id)
        if not post:
            return Response({
                "message": "해당 게시글을 찾을 수 없습니다.",
            }, status=status.HTTP_404_NOT_FOUND)

        post.delete()
        return Response({
            "message": f"{post_id}번 게시글이 삭제되었습니다.",
        }, status=status.HTTP_200_OK)