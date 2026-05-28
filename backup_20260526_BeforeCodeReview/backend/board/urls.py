"""
board/urls.py
config/urls.py 에서 path('api/board/', include('board.urls')) 로 포함됨
"""

from django.urls import path
from .views import BoardListView, BoardDetailView

urlpatterns = [
    # 게시글 목록 / 작성
    # GET  /api/board/                → 전체 목록
    # GET  /api/board/?category=notice → 공지사항만
    # POST /api/board/                → 새 글 작성 (관리자만)
    path('', BoardListView.as_view(), name='board_list'),

    # 게시글 상세 / 수정 / 삭제
    # GET    /api/board/<id>/  → 상세 조회 (조회수 +1)
    # PUT    /api/board/<id>/  → 수정 (관리자만)
    # DELETE /api/board/<id>/  → 삭제 (관리자만)
    path('<int:post_id>/', BoardDetailView.as_view(), name='board_detail'),
]