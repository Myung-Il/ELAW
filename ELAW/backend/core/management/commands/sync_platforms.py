"""
python manage.py sync_platforms --user=<email> --platform=<baekjoon|github>

예시:
  python manage.py sync_platforms --user=student1@elaw.kr --platform=baekjoon
  python manage.py sync_platforms --user=student1@elaw.kr  # 전체 동기화
  python manage.py sync_platforms --all                     # 전체 사용자 동기화
"""

import logging
from django.core.management.base import BaseCommand
from core.models import User, PlatformLink

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "백준/GitHub 플랫폼 데이터 동기화"

    def add_arguments(self, parser):
        parser.add_argument("--user",     type=str, help="특정 사용자 이메일")
        parser.add_argument("--platform", type=str, help="baekjoon | github")
        parser.add_argument("--all",      action="store_true", help="전체 사용자 동기화")

    def handle(self, *args, **options):
        from core.etl.baekjoon_collector import BaekjoonCollector
        from core.etl.github_collector import GitHubCollector

        # 대상 사용자 결정
        if options["all"]:
            users = User.objects.filter(role="student", is_active=True)
        elif options["user"]:
            users = User.objects.filter(email=options["user"])
            if not users.exists():
                self.stderr.write(f"사용자를 찾을 수 없습니다: {options['user']}")
                return
        else:
            self.stderr.write("--user=<email> 또는 --all 옵션을 지정해주세요.")
            return

        target_platform = options.get("platform")

        total_synced = 0
        total_errors = 0

        for user in users:
            qs = PlatformLink.objects.filter(user=user, is_active=True)
            if target_platform:
                qs = qs.filter(platform=target_platform)

            for link in qs:
                self.stdout.write(
                    f"  ▶ {user.email} / {link.platform} ({link.external_id}) 동기화 중..."
                )

                if link.platform == "baekjoon":
                    result = BaekjoonCollector(user, link).sync()
                elif link.platform == "github":
                    result = GitHubCollector(user, link).sync()
                else:
                    self.stdout.write(f"    {link.platform}: 수집기 미구현, 건너뜀")
                    continue

                synced = result.get("synced", result.get("repos", 0))
                errors = result.get("errors", 0)
                msg    = result.get("message", "")
                total_synced += synced
                total_errors += errors

                status_icon = "✅" if errors == 0 else "⚠️"
                self.stdout.write(
                    f"    {status_icon} {synced}건 저장, 오류 {errors}건 — {msg}"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n동기화 완료 — 총 {total_synced}건 저장, {total_errors}건 오류"
            )
        )
