from django.urls import path
from .views import (
    BoardListView, BoardDetailView,
    CommentListView, CommentDetailView,
    PostLikeView, AttachmentView,
)

urlpatterns = [
    path('', BoardListView.as_view(), name='board_list'),
    path('<int:post_id>/', BoardDetailView.as_view(), name='board_detail'),
    path('<int:post_id>/comments/', CommentListView.as_view(), name='comment_list'),
    path('<int:post_id>/comments/<int:comment_id>/', CommentDetailView.as_view(), name='comment_detail'),
    path('<int:post_id>/like/', PostLikeView.as_view(), name='post_like'),
    path('<int:post_id>/attachments/', AttachmentView.as_view(), name='attachment_upload'),
    path('<int:post_id>/attachments/<int:attachment_id>/', AttachmentView.as_view(), name='attachment_delete'),
]
