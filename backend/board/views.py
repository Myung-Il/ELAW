from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import datetime

# 📦 성환님의 DB가 오기 전까지 사용할 '가짜 DB (임시 창고)'
mock_board_db = [
    {"id": 1, "title": "첫 번째 공지사항입니다", "content": "게시판 기능 테스트 중입니다.", "author": "관리자", "created_at": "2026-04-25"},
    {"id": 2, "title": "가입 인사드립니다!", "content": "반갑습니다. 잘 부탁드려요.", "author": "재민테스트", "created_at": "2026-04-25"}
]
global_id_counter = 3 # 다음에 쓰일 글 번호

class BoardListView(APIView):

    # 📖 1. 게시글 목록 불러오기 (GET)
    def get(self, request):
        return Response({
            "message": "게시글 목록 조회 성공 (임시 데이터)",
            "data": mock_board_db
        }, status=status.HTTP_200_OK)

    # ✍️ 2. 새 게시글 작성하기 (POST)
    def post(self, request):
        global global_id_counter

        # 프론트엔드(재민님)가 보낸 제목과 내용 데이터 꺼내기
        title = request.data.get("title", "제목 없음")
        content = request.data.get("content", "내용 없음")

        # 새 게시글 딕셔너리 만들어서 가짜 DB에 추가하기
        new_post = {
            "id": global_id_counter,
            "title": title,
            "content": content,
            "author": "건휘테스트", # 나중엔 로그인한 유저 이름으로 바뀝니다
            "created_at": str(datetime.date.today())
        }
        mock_board_db.append(new_post)
        global_id_counter += 1 # 다음 글 번호를 위해 1 증가

        return Response({
            "message": "게시글 작성 성공!",
            "data": new_post
        }, status=status.HTTP_201_CREATED)

class BoardDetailView(APIView):
    # 📖 3. 특정 게시글 하나만 상세 보기 (GET)
    def get(self, request, post_id):
        for post in mock_board_db:
            if post["id"] == post_id:
                return Response({"message": f"{post_id}번 게시글 상세 조회 성공", "data": post}, status=status.HTTP_200_OK)
        return Response({"message": "해당 게시글을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

    # 🔄 4. 특정 게시글 수정하기 (PUT)
    def put(self, request, post_id):
        for post in mock_board_db:
            if post["id"] == post_id:
                # 프론트엔드가 보낸 새로운 제목과 내용으로 덮어쓰기 (안 보냈으면 원래 내용 유지)
                post["title"] = request.data.get("title", post["title"])
                post["content"] = request.data.get("content", post["content"])
                return Response({"message": f"{post_id}번 게시글 수정 완료!", "data": post}, status=status.HTTP_200_OK)
        return Response({"message": "해당 게시글을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

    # 🗑️ 5. 특정 게시글 삭제하기 (DELETE)
    def delete(self, request, post_id):
        for post in mock_board_db:
            if post["id"] == post_id:
                mock_board_db.remove(post) # 가짜 DB(리스트)에서 해당 글 완전 삭제
                return Response({"message": f"{post_id}번 게시글이 삭제되었습니다."}, status=status.HTTP_200_OK)
        return Response({"message": "해당 게시글을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)