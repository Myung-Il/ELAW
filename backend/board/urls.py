from django.urls import path
from .views import BoardListView, BoardDetailView

urlpatterns = [
    # /api/board/ 로 접속하면 이 리스트/작성 기능이 실행됩니다.
    path('', BoardListView.as_view(), name='board_list'),

    path('<int:post_id>/', BoardDetailView.as_view(), name='board_detail'),
]