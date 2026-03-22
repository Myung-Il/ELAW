from django.urls import path
from .views import SignupView
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    # /signup/ 이라는 주소로 오면 SignupView 창구가 응답하도록 연결합니다.
    path('signup/', SignupView.as_view(), name='signup'),

    path('login/', TokenObtainPairView.as_view(), name='login'),
]