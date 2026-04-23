from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import UserSerializer

class SignupView(APIView):
    # 프론트엔드에서 데이터를 '보낼 때(POST)' 실행되는 함수입니다.
    def post(self, request):
        # 1. 프론트엔드가 보낸 데이터를 번역기(Serializer)에 넣습니다.
        serializer = UserSerializer(data=request.data)

        # 2. 데이터가 형식에 맞게 잘 들어왔는지 검사합니다.
        if serializer.is_valid():
            # 3. 통과하면 DB에 저장(가입)합니다.
            serializer.save()
            return Response({"message": "회원가입이 성공적으로 완료되었습니다!"}, status=status.HTTP_201_CREATED)

        # 4. 데이터에 문제가 있으면 에러 이유를 프론트엔드에 알려줍니다.
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)