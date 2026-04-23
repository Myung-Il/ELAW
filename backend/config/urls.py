from django.contrib import admin
from django.urls import path, include  # include를 추가로 불러옵니다.

urlpatterns = [
    path('admin/', admin.site.urls),
    # 프론트엔드가 http://127.0.0.1:8000/api/accounts/... 로 시작하는 주소로 접속하면, 
    # accounts 폴더 안의 urls.py로 길을 안내해 줍니다.
    path('api/accounts/', include('accounts.urls')),
]