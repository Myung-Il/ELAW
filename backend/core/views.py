from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class MainProgressView(APIView):
    # 메인 페이지 데이터는 달라고 '요청(GET)'하는 것이므로 def get()을 씁니다.
    def get(self, request):

        # 성환님의 DB가 완성되기 전까지 재민(프론트)님에게 쏴줄 임시 가짜 데이터!
        mock_data = {
            "message": "메인 페이지 데이터 조회 성공 (DB 연결 전 임시 데이터)",
            "user_nickname": "건휘테스트", # 나중에 실제 로그인한 유저 이름으로 바꿀 예정
            "total_progress_percent": 75,
            "curriculum_details": {
                "공부": 80,
                "이벤트": 100,
                "취업": 40,
                "게시판": 10
            }
        }

        return Response(mock_data, status=status.HTTP_200_OK)