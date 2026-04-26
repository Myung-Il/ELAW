"""
사용자 관련 Django 모델
DB 팀은 이 모델을 참고하여 test_db 폴더의 SQL 스키마를 작성하세요
"""

from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    ELAW 사용자 모델 - Django 기본 User 확장
    [DB 팀] users 테이블에 해당
    """

    # 학과 정보
    dept = models.CharField(max_length=100, blank=True, verbose_name="학과")
    # 학년
    year = models.CharField(max_length=20, blank=True, verbose_name="학년")
    # 전화번호
    phone = models.CharField(max_length=20, blank=True, verbose_name="전화번호")

    class Meta:
        db_table = "users"
        verbose_name = "사용자"

    def __str__(self):
        return f"{self.username} ({self.dept})"


class UserGoal(models.Model):
    """
    사용자 목표 설정 - 최초 로그인 시 설정
    [DB 팀] user_goals 테이블에 해당
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="goals")
    # 희망 직무 분야
    job_field = models.CharField(max_length=100, verbose_name="희망 직무")
    # 최초 설정 완료 여부
    is_first_setup = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_goals"
        verbose_name = "사용자 목표"

    def __str__(self):
        return f"{self.user.username}의 목표: {self.job_field}"


class Application(models.Model):
    """
    기업 지원 현황
    [DB 팀] applications 테이블에 해당
    """

    STATUS_CHOICES = [
        ("pending", "서류 검토 중"),
        ("passed", "합격"),
        ("failed", "불합격"),
        ("interviewing", "면접 진행 중"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="applications")
    # [BE 팀] Company 모델 연결 필요
    company_name = models.CharField(max_length=200)
    position = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "applications"
        verbose_name = "지원 현황"

    def __str__(self):
        return f"{self.user.username} → {self.company_name} ({self.status})"