"""풀백 터널 URL 게시기 — cloudflared 로그에서 quick tunnel URL을 파싱해 Supabase에 게시.

supervisord가 상시 실행한다 (program:url_publisher).
로컬 PC의 전환 스크립트(scripts/switch_backend.ps1)가 infra_endpoint 테이블에서
'fallback' 행을 조회해 Vercel NEXT_PUBLIC_API_URL을 갱신한다.

- 테이블은 시작 시 자체 생성(idempotent)하며 RLS를 활성화한다 —
  정책을 만들지 않으므로 anon/authenticated 키로는 접근 불가 (Django/ops는 postgres 직결).
- Transaction pooler(6543) 경유이므로 prepare_threshold=None 필수.
"""
import re
import sys
import time

import psycopg
from dotenv import dotenv_values

ENV_PATH = "/volume/elaw/app/backend/.env"
LOG_PATH = "/volume/elaw/logs/cloudflared.log"
POLL_SEC = 15
URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")

DDL = """
CREATE TABLE IF NOT EXISTS public.infra_endpoint (
    name        text PRIMARY KEY,
    url         text NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.infra_endpoint ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.infra_endpoint FROM anon, authenticated;
"""

UPSERT = """
INSERT INTO public.infra_endpoint (name, url, updated_at)
VALUES ('fallback', %s, now())
ON CONFLICT (name) DO UPDATE SET url = EXCLUDED.url, updated_at = now();
"""


def connect(env):
    return psycopg.connect(
        dbname=env.get("DB_NAME", "postgres"),
        user=env["DB_USER"],
        password=env["DB_PASSWORD"],
        host=env["DB_HOST"],
        port=env.get("DB_PORT", "6543"),
        sslmode="require",
        prepare_threshold=None,  # transaction pooler 호환
        connect_timeout=15,
    )


def latest_tunnel_url():
    try:
        with open(LOG_PATH, errors="ignore") as f:
            matches = URL_RE.findall(f.read())
    except FileNotFoundError:
        return None
    return matches[-1] if matches else None


def main():
    env = dotenv_values(ENV_PATH)
    if not env.get("DB_PASSWORD"):
        sys.exit(f"[url_publisher] {ENV_PATH} 에 DB 접속 정보가 없습니다")

    # 테이블 보장 (재시도 — 기동 직후 네트워크 흔들림 흡수)
    for attempt in range(5):
        try:
            with connect(env) as conn:
                conn.execute(DDL)
            print("[url_publisher] infra_endpoint 테이블 확인/생성 + RLS 적용", flush=True)
            break
        except Exception as e:  # noqa: BLE001
            print(f"[url_publisher] DDL 재시도 {attempt + 1}/5: {e}", flush=True)
            time.sleep(10)
    else:
        sys.exit("[url_publisher] 테이블 생성 실패")

    published = None
    while True:
        url = latest_tunnel_url()
        if url and url != published:
            try:
                with connect(env) as conn:
                    conn.execute(UPSERT, (url,))
                published = url
                print(f"[url_publisher] 게시 완료: {url}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[url_publisher] 게시 실패(다음 주기에 재시도): {e}", flush=True)
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
