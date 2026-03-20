from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # ERD에 정의된 역할(role)
    ROLE_CHOICES = (
        ('student', '학생'),
        ('company', '기업'),
        ('admin', '관리자'),
    )

    # 1. 공통 필드
    name = models.CharField(max_length=50)
    email = models.EmailField(max_length=100, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=20, blank=True, null=True)

    # 2. 기업 전용 필드 (학생일 경우 빈칸으로 저장됨)
    company_name = models.CharField(max_length=100, blank=True, null=True)
    business_number = models.CharField(max_length=50, blank=True, null=True)
    manager_name = models.CharField(max_length=50, blank=True, null=True)

    # 3. 동의 여부 필드
    ai_consent = models.BooleanField(default=False)
    privacy_consent = models.BooleanField(default=False)

    # 4. 시간 필드 (장고에서 password_hash, last_login, is_active는 자동 지원합니다)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'  # DB 다이어그램에 맞춰 테이블 이름을 users로 강제 지정from django.db import models

# Create your models here.
