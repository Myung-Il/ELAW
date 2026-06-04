# Supabase public 스키마 초기화 스크립트
# 수작업 SQL로 만든 기존 테이블을 모두 드롭하고, Django migrate가 정확한 스키마를
# 재생성할 수 있도록 비운다. (데이터는 backend/backup_sqlite.json 으로 복원)
#
# 사용법:
#   python scripts/supabase_reset.py          # dry-run: 드롭 대상 테이블·행수만 출력
#   python scripts/supabase_reset.py --yes    # 실제 드롭 실행
#
# 접속 정보: backend/.env 의 DB_USER / DB_PASSWORD / DB_HOST / DB_PORT / DB_NAME
# (DB_ENGINE 주석 여부와 무관하게 동작)

import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
ENV = dotenv_values(ROOT / "backend" / ".env")


def connect():
    missing = [k for k in ("DB_USER", "DB_PASSWORD", "DB_HOST") if not ENV.get(k)]
    if missing:
        sys.exit(f"backend/.env 에 다음 값이 비어 있습니다: {', '.join(missing)}")
    return psycopg.connect(
        dbname=ENV.get("DB_NAME", "postgres"),
        user=ENV["DB_USER"],
        password=ENV["DB_PASSWORD"],
        host=ENV["DB_HOST"],
        port=ENV.get("DB_PORT", "5432"),
        sslmode="require",
    )


def main():
    do_drop = "--yes" in sys.argv
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
        tables = [r[0] for r in cur.fetchall()]
        if not tables:
            print("public 스키마에 테이블이 없습니다. 바로 migrate 하세요.")
            return

        print(f"public 스키마 테이블 {len(tables)}개:")
        for t in tables:
            cur.execute(f'SELECT count(*) FROM public."{t}"')
            print(f"  {t:32s}: {cur.fetchone()[0]:>6} 행")

        if not do_drop:
            print("\n[dry-run] 실제 드롭하려면 --yes 옵션을 붙여 다시 실행하세요.")
            return

        print("\n드롭 진행 중...")
        for t in tables:
            cur.execute(f'DROP TABLE IF EXISTS public."{t}" CASCADE')
            print(f"  DROP {t}")
        # 남은 시퀀스·뷰 정리 (CASCADE로 대부분 제거되지만 잔여물 방지)
        cur.execute("SELECT viewname FROM pg_views WHERE schemaname = 'public'")
        for (v,) in cur.fetchall():
            cur.execute(f'DROP VIEW IF EXISTS public."{v}" CASCADE')
        cur.execute(
            "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'"
        )
        for (s,) in cur.fetchall():
            cur.execute(f'DROP SEQUENCE IF EXISTS public."{s}" CASCADE')
        conn.commit()
        print(f"\n완료: 테이블 {len(tables)}개 드롭. 이제 python manage.py migrate 를 실행하세요.")


if __name__ == "__main__":
    main()
