"""
board/views.py
권한:
  - 조회 (GET): 누구나
  - 공지·이벤트·대회 작성/수정/삭제: 관리자(is_staff)만
  - Q&A 작성: 인증된 사용자 누구나
  - 댓글 작성: 인증된 사용자 / 수정·삭제: 본인만
  - 좋아요: 인증된 사용자
"""

from rest_framework import status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

import os
from core.models import Post, Comment, PostLike, PostView, PostAttachment, ALLOWED_EXTENSIONS
from .serializers import (
    PostListSerializer, PostDetailSerializer,
    PostCreateUpdateSerializer, CommentSerializer, AttachmentSerializer,
)

ADMIN_ONLY_CATEGORIES = {'notice', 'contest', 'event'}


def check_admin(user):
    if not user or not user.is_authenticated:
        raise PermissionDenied("로그인이 필요합니다.")
    if not user.is_staff:
        raise PermissionDenied("관리자만 가능한 작업입니다.")


# ──────────────────────────────────────────────
# 게시글 목록 / 작성
# ──────────────────────────────────────────────

class BoardListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        category = request.query_params.get('category')
        qs = Post.objects.select_related('author').prefetch_related('comments').all()
        if category:
            qs = qs.filter(category=category)
        # 내 글 필터 (?my=true, 인증 사용자만)
        if request.query_params.get('my') and request.user and request.user.is_authenticated:
            qs = qs.filter(author=request.user)
        qs = qs.order_by('-is_pinned', '-like_count', '-created_at')

        total = qs.count()
        try:
            limit  = max(1, min(int(request.query_params.get('limit',  10)), 50))
            offset = max(0, int(request.query_params.get('offset', 0)))
        except (ValueError, TypeError):
            limit, offset = 10, 0

        serializer = PostListSerializer(qs[offset: offset + limit], many=True)
        return Response({
            "message": "게시글 목록 조회 성공",
            "count": total,
            "limit": limit,
            "offset": offset,
            "has_next": offset + limit < total,
            "data": serializer.data,
        }, status=drf_status.HTTP_200_OK)

    def post(self, request):
        category = request.data.get('category', '')
        # Q&A는 일반 사용자도 작성 가능, 나머지는 관리자만
        if category in ADMIN_ONLY_CATEGORIES:
            check_admin(request.user)

        serializer = PostCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            post = serializer.save(author=request.user)
            return Response({
                "message": "게시글 작성 성공",
                "data": PostDetailSerializer(post).data,
            }, status=drf_status.HTTP_201_CREATED)
        return Response({"message": "입력값 오류", "errors": serializer.errors},
                        status=drf_status.HTTP_400_BAD_REQUEST)


# ──────────────────────────────────────────────
# 게시글 상세 / 수정 / 삭제
# ──────────────────────────────────────────────

class BoardDetailView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def _get_post(self, post_id):
        try:
            return Post.objects.prefetch_related(
                'comments__author', 'attachments'
            ).select_related('author').get(id=post_id)
        except Post.DoesNotExist:
            return None

    def get(self, request, post_id):
        post = self._get_post(post_id)
        if not post:
            return Response({"message": "게시글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)

        # 조회수: 인증된 사용자는 계정당 1회만
        if request.user and request.user.is_authenticated:
            _, created = PostView.objects.get_or_create(post=post, user=request.user)
            if created:
                Post.objects.filter(id=post_id).update(view_count=post.view_count + 1)
                post.view_count += 1
        # 비로그인은 조회수 미카운트

        # 현재 사용자의 좋아요 여부
        user_liked = (
            request.user.is_authenticated and
            PostLike.objects.filter(post=post, user=request.user).exists()
        )

        data = PostDetailSerializer(post, context={'request': request}).data
        data['user_liked'] = user_liked
        return Response({"message": "조회 성공", "data": data}, status=drf_status.HTTP_200_OK)

    def put(self, request, post_id):
        check_admin(request.user)
        post = self._get_post(post_id)
        if not post:
            return Response({"message": "게시글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)

        serializer = PostCreateUpdateSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response({"message": "수정 완료", "data": PostDetailSerializer(updated).data})
        return Response({"message": "입력값 오류", "errors": serializer.errors},
                        status=drf_status.HTTP_400_BAD_REQUEST)

    def delete(self, request, post_id):
        check_admin(request.user)
        post = self._get_post(post_id)
        if not post:
            return Response({"message": "게시글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)
        post.delete()
        return Response({"message": "삭제 완료"}, status=drf_status.HTTP_200_OK)


# ──────────────────────────────────────────────
# 댓글 목록 / 작성
# ──────────────────────────────────────────────

class CommentListView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({"message": "게시글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)

        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            comment = serializer.save(post=post, author=request.user)
            return Response(CommentSerializer(comment).data, status=drf_status.HTTP_201_CREATED)
        return Response(serializer.errors, status=drf_status.HTTP_400_BAD_REQUEST)


# ──────────────────────────────────────────────
# 댓글 수정 / 삭제
# ──────────────────────────────────────────────

class CommentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_comment(self, post_id, comment_id, user):
        try:
            comment = Comment.objects.get(id=comment_id, post_id=post_id)
        except Comment.DoesNotExist:
            return None, Response({"message": "댓글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)
        if comment.author != user:
            return None, Response({"message": "본인 댓글만 수정·삭제할 수 있습니다."}, status=drf_status.HTTP_403_FORBIDDEN)
        return comment, None

    def put(self, request, post_id, comment_id):
        comment, err = self._get_comment(post_id, comment_id, request.user)
        if err:
            return err
        serializer = CommentSerializer(comment, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(CommentSerializer(updated).data)
        return Response(serializer.errors, status=drf_status.HTTP_400_BAD_REQUEST)

    def delete(self, request, post_id, comment_id):
        comment, err = self._get_comment(post_id, comment_id, request.user)
        if err:
            return err
        comment.delete()
        return Response(status=drf_status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────
# 좋아요 토글
# ──────────────────────────────────────────────

class PostLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({"message": "게시글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)

        like, created = PostLike.objects.get_or_create(post=post, user=request.user)
        if created:
            Post.objects.filter(id=post_id).update(like_count=post.like_count + 1)
            liked = True
            like_count = post.like_count + 1
        else:
            like.delete()
            new_count = max(post.like_count - 1, 0)
            Post.objects.filter(id=post_id).update(like_count=new_count)
            liked = False
            like_count = new_count

        return Response({"liked": liked, "like_count": like_count})


# ──────────────────────────────────────────────
# 첨부파일 업로드 / 삭제
# ──────────────────────────────────────────────

class AttachmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        """파일 업로드 (작성자만)"""
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({"message": "게시글을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)

        if post.author != request.user and not request.user.is_staff:
            return Response({"message": "작성자만 파일을 업로드할 수 있습니다."}, status=drf_status.HTTP_403_FORBIDDEN)

        files = request.FILES.getlist('files')
        if not files:
            return Response({"message": "업로드할 파일이 없습니다."}, status=drf_status.HTTP_400_BAD_REQUEST)

        if post.attachments.count() + len(files) > 5:
            return Response({"message": "첨부파일은 최대 5개까지 가능합니다."}, status=drf_status.HTTP_400_BAD_REQUEST)

        created = []
        for f in files:
            ext = os.path.splitext(f.name)[1].lstrip('.').lower()
            if ext not in ALLOWED_EXTENSIONS:
                return Response(
                    {"message": f"허용되지 않는 파일 형식입니다: .{ext}"},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            if f.size > 10 * 1024 * 1024:
                return Response({"message": "파일 크기는 10MB 이하여야 합니다."}, status=drf_status.HTTP_400_BAD_REQUEST)

            att = PostAttachment.objects.create(
                post=post,
                file=f,
                original_name=f.name,
                file_size=f.size,
            )
            created.append(att)

        return Response(
            AttachmentSerializer(created, many=True, context={'request': request}).data,
            status=drf_status.HTTP_201_CREATED,
        )

    def delete(self, request, post_id, attachment_id):
        """첨부파일 삭제 (작성자 또는 관리자)"""
        try:
            att = PostAttachment.objects.get(id=attachment_id, post_id=post_id)
        except PostAttachment.DoesNotExist:
            return Response({"message": "파일을 찾을 수 없습니다."}, status=drf_status.HTTP_404_NOT_FOUND)

        if att.post.author != request.user and not request.user.is_staff:
            return Response({"message": "삭제 권한이 없습니다."}, status=drf_status.HTTP_403_FORBIDDEN)

        # 실제 파일도 삭제
        if att.file and os.path.isfile(att.file.path):
            os.remove(att.file.path)
        att.delete()
        return Response(status=drf_status.HTTP_204_NO_CONTENT)
