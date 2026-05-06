"""
core/signals.py

Django 시그널 핸들러.

- JobProblemSolveHistory 저장 후  → SkillGap 재계산
- PlatformLink 저장/업데이트 후   → 해당 플랫폼 ETL 동기화
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='core.JobProblemSolveHistory')
def on_job_problem_solved(sender, instance, created, **kwargs):
    """새 풀이 기록이 생성되면 해당 사용자의 모든 SkillGap 재계산."""
    if not created:
        return
    try:
        from core.services.skill_gap_service import SkillGapService
        SkillGapService().recalculate_for_user(instance.user)
    except Exception:
        pass  # SkillGap 재계산 실패가 풀이 저장을 막으면 안 됨


@receiver(post_save, sender='core.PlatformLink')
def on_platform_link_updated(sender, instance, created, **kwargs):
    """플랫폼 연동 후 즉시 ETL 동기화 (동기)."""
    if not instance.is_active:
        return
    try:
        if instance.platform == 'baekjoon':
            from core.etl.baekjoon_collector import BaekjoonCollector
            BaekjoonCollector(instance.user, instance).sync()
        elif instance.platform == 'github':
            from core.etl.github_collector import GitHubCollector
            GitHubCollector(instance.user, instance).sync()
    except Exception:
        pass  # ETL 실패가 요청을 막으면 안 됨
