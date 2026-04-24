"""
accounts/serializers.py
"""

from rest_framework import serializers
from core.models import User, PlatformLink


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


class PlatformLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlatformLink
        fields = ["id", "platform", "external_id", "last_synced", "is_active", "created_at"]
        read_only_fields = ["id", "last_synced", "created_at"]
