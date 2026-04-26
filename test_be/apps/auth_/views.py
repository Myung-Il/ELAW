"""
인증 관련 API 뷰
로그인, 로그아웃, 토큰 갱신, SMS 인증
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate


@api_view(["POST"])
@permission_classes([AllowAny])
def user_login(request):
    """
    사용자 로그인
    POST /api/v1/auth/user/login
    Request: { user_id: string, password: string }
    Response: { access_token, refresh_token, is_first_login: bool, user: {...} }
    """
    user_id = request.data.get("user_id")
    password = request.data.get("password")

    if not user_id or not password:
        return Response(
            {"message": "아이디와 비밀번호를 입력해주세요."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # [DB 팀] Users 테이블에서 user_id로 조회 후 bcrypt 비밀번호 검증
    user = authenticate(username=user_id, password=password)

    if user is None:
        return Response(
            {"message": "아이디 또는 비밀번호가 잘못되었습니다."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # JWT 토큰 발급
    refresh = RefreshToken.for_user(user)

    # [DB 팀] UserGoals 테이블에서 is_first_setup 컬럼 확인
    is_first_login = not hasattr(user, "goals") or user.goals is None

    return Response({
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
        "is_first_login": is_first_login,
        "user": {
            "id": user.id,
            "name": user.get_full_name(),
            "dept": getattr(user, "dept", ""),
        },
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def company_login(request):
    """
    기업 로그인
    POST /api/v1/auth/company/login
    Request: { email: string, password: string }
    Response: { access_token, company: { id, name } }
    """
    email = request.data.get("email")
    password = request.data.get("password")

    # [DB 팀] Companies 테이블에서 manager_email로 조회
    # TODO: 기업 인증 로직 구현
    return Response({"message": "기업 로그인 API - 구현 필요"}, status=status.HTTP_501_NOT_IMPLEMENTED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    로그아웃 - 리프레시 토큰 블랙리스트 처리
    POST /api/v1/auth/logout
    """
    try:
        refresh_token = request.data.get("refresh_token")
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({"message": "로그아웃 되었습니다."})
    except Exception:
        return Response({"message": "로그아웃 처리 중 오류가 발생했습니다."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """
    현재 로그인한 사용자 정보 반환
    GET /api/v1/auth/me
    """
    user = request.user
    return Response({
        "id": user.id,
        "name": user.get_full_name(),
        "dept": getattr(user, "dept", ""),
        "email": user.email,
    })