"""
board/serializers.py
core.Post 모델용 Serializer
"""

from rest_framework import serializers
from core.models import Post


class PostListSerializer(serializers.ModelSerializer):
    """게시글 목록용 - 간단한 정보만"""
    author_name = serializers.CharField(source='author.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'category', 'category_display', 'title',
            'author_name', 'is_pinned', 'view_count',
            'created_at', 'updated_at',
        ]


class PostDetailSerializer(serializers.ModelSerializer):
    """게시글 상세용 - 전체 정보"""
    author_name = serializers.CharField(source='author.name', read_only=True)
    author_email = serializers.CharField(source='author.email', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'category', 'category_display', 'title', 'content',
            'author', 'author_name', 'author_email',
            'is_pinned', 'view_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'view_count', 'created_at', 'updated_at']


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    """게시글 작성/수정용"""

    class Meta:
        model = Post
        fields = ['category', 'title', 'content', 'is_pinned']

    def validate_category(self, value):
        """카테고리 유효성 검사"""
        valid_categories = ['notice', 'contest', 'event']
        if value not in valid_categories:
            raise serializers.ValidationError(
                f"카테고리는 {valid_categories} 중 하나여야 합니다."
            )
        return value