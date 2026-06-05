"""Supabase infra_endpoint에서 풀백 서버의 현재 터널 URL을 조회해 출력한다.

풀백의 url_publisher.py가 게시한 값을 읽는 쪽 — scripts/switch_backend.ps1이 사용.
출력: URL 한 줄 (stdout). 행이 없거나 오래됐으면 stderr 경고 + 종료코드 1.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / "backend" / ".env")

STALE_HOURS = 24  # updated_at이 이보다 오래되면 경고


def main() -> int:
    with psycopg.connect(
        dbname=ENV.get("DB_NAME", "postgres"),
        user=ENV["DB_USER"],
        password=ENV["DB_PASSWORD"],
        host=ENV["DB_HOST"],
        port=ENV.get("DB_PORT", "5432"),
        sslmode="require",
        connect_timeout=15,
    ) as conn:
        row = conn.execute(
            "SELECT url, updated_at FROM public.infra_endpoint WHERE name = 'fallback'"
        ).fetchone()

    if not row:
        print("infra_endpoint에 'fallback' 행이 없습니다 — 풀백 서버 가동 여부 확인", file=sys.stderr)
        return 1

    url, updated_at = row
    age_h = (datetime.now(timezone.utc) - updated_at).total_seconds() / 3600
    if age_h > STALE_HOURS:
        print(f"경고: 풀백 URL이 {age_h:.0f}시간 전 게시됨 — 풀백 상태 확인 권장", file=sys.stderr)
    print(url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
