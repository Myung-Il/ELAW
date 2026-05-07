"""
accounts/urls.py
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    SignupView,
    ProfileView,
    PlatformLinkView,
    PlatformSyncView,
    PlatformStatusView,
)

urlpatterns = [
    # 인증
    path("signup/",        SignupView.as_view(),          name="signup"),
    path("login/",         TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(),    name="token_refresh"),

    # 프로필
    # GET   → 내 프로필 조회
    # PATCH → 내 프로필 수정 (name, phone, ai_consent, privacy_consent)
    path("profile/",       ProfileView.as_view(),         name="profile"),

    # 플랫폼 연동 (기존)
    path("platform/",        PlatformLinkView.as_view(),   name="platform_link"),
    path("platform/sync/",   PlatformSyncView.as_view(),   name="platform_sync"),
    path("platform/status/", PlatformStatusView.as_view(), name="platform_status"),
]