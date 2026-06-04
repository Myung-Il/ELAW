# Supabase RLS 정책 적용 스크립트
# DB/sql/05_rls_policies.sql 을 backend/.env 의 접속 정보로 실행한다.
# 재실행 안전. Django 마이그레이션으로 테이블이 추가될 때마다 다시 실행할 것.
#
# 사용법: python scripts/apply_supabase_rls.py

import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
ENV = dotenv_values(ROOT / "backend" / ".env")
SQL_FILE = ROOT / "DB" / "sql" / "05_rls_policies.sql"


def main():
    missing = [k for k in ("DB_USER", "DB_PASSWORD", "DB_HOST") if not ENV.get(k)]
    if missing:
        sys.exit(f"backend/.env 에 다음 값이 비어 있습니다: {', '.join(missing)}")

    sql = SQL_FILE.read_text(encoding="utf-8")
    with psycopg.connect(
        dbname=ENV.get("DB_NAME", "postgres"),
        user=ENV["DB_USER"],
        password=ENV["DB_PASSWORD"],
        host=ENV["DB_HOST"],
        port=ENV.get("DB_PORT", "5432"),
        sslmode="require",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            # 적용 결과 요약: RLS 활성 테이블 수 + 공개 읽기 정책 목록
            cur.execute(
                "SELECT count(*) FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename "
                "WHERE t.schemaname = 'public' AND c.relrowsecurity"
            )
            rls_count = cur.fetchone()[0]
            cur.execute(
                "SELECT tablename, policyname FROM pg_policies "
                "WHERE schemaname = 'public' ORDER BY tablename"
            )
            policies = cur.fetchall()
        conn.commit()

    print(f"RLS 활성화된 테이블: {rls_count}개")
    print(f"공개 읽기 정책 {len(policies)}개:")
    for table, policy in policies:
        print(f"  {table:32s}: {policy}")


if __name__ == "__main__":
    main()
