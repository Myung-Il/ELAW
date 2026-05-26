"""
accounts/serializers.py
"""

from rest_framework import serializers
from core.models import User, PlatformLink


# ─────────────────────────────────────────
# 회원가입용 Serializer (기존)
# ─────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ["id", "email", "password", "name", "role",
                  "phone", "ai_consent", "privacy_consent"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ─────────────────────────────────────────
# 프로필 조회용 Serializer (신규)
# ─────────────────────────────────────────

class ProfileSerializer(serializers.ModelSerializer):
    """내 프로필 조회/수정용 - password 제외, 민감정보 제외"""

    role_display = serializers.CharField(source='get_role_display', read_only=True)
    platform_links_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'role', 'role_display',
            'phone', 'ai_consent', 'privacy_consent',
            'is_active', 'created_at', 'updated_at',
            'platform_links_count',
        ]
        read_only_fields = [
            'id', 'email', 'role', 'role_display',
            'is_active', 'created_at', 'updated_at',
            'platform_links_count',
        ]
        # email/role은 변경 불가 (수정 시에도 보호)

    def get_platform_links_count(self, obj):
        """연동된 플랫폼 개수 (백준/GitHub 등)"""
        return PlatformLink.objects.filter(user=obj, is_active=True).count()


# ─────────────────────────────────────────
# 플랫폼 연동용 Serializer (기존)
# ─────────────────────────────────────────

class PlatformLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlatformLink
        fields = ["id", "platform", "external_id", "last_synced", "is_active", "created_at"]
        read_only_fields = ["id", "last_synced", "created_at"]