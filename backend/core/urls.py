from django.urls import path
from .views import MainProgressView

urlpatterns = [
    # 프론트에서 /progress/ 로 접속하면 MainProgressView가 응답합니다.
    path('progress/', MainProgressView.as_view(), name='main_progress'),
]