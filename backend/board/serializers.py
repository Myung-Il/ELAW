from rest_framework import serializers
from core.models import Post, Comment, PostAttachment


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model  = PostAttachment
        fields = ['id', 'original_name', 'file_size', 'url', 'uploaded_at']

    def get_url(self, obj):
        # 상대 경로 반환 → Next.js /media/ 프록시가 처리
        return obj.file.url


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)
    author_id   = serializers.IntegerField(source='author.id', read_only=True)

    class Meta:
        model  = Comment
        fields = ['id', 'author_id', 'author_name', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author_id', 'author_name', 'created_at', 'updated_at']


class PostListSerializer(serializers.ModelSerializer):
    author_name      = serializers.CharField(source='author.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    comment_count    = serializers.SerializerMethodField()

    class Meta:
        model  = Post
        fields = [
            'id', 'category', 'category_display', 'title',
            'author_name', 'is_pinned', 'view_count', 'like_count', 'comment_count',
            'created_at', 'updated_at',
        ]

    def get_comment_count(self, obj):
        return obj.comments.count()


class PostDetailSerializer(serializers.ModelSerializer):
    author_name      = serializers.CharField(source='author.name', read_only=True)
    author_id        = serializers.IntegerField(source='author.id', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    comments         = CommentSerializer(many=True, read_only=True)
    attachments      = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model  = Post
        fields = [
            'id', 'category', 'category_display', 'title', 'content',
            'author_id', 'author_name',
            'is_pinned', 'view_count', 'like_count',
            'attachments', 'comments',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author_id', 'view_count', 'like_count', 'created_at', 'updated_at']


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Post
        fields = ['category', 'title', 'content', 'is_pinned']

    def validate_category(self, value):
        valid = [c[0] for c in Post.Category.choices]
        if value not in valid:
            raise serializers.ValidationError(f"카테고리는 {valid} 중 하나여야 합니다.")
        return value
