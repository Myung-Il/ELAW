"""목표 생성 API의 경로별 소요 시간 비교 (로컬 PC에서 실행).

경로 A: Vercel 프록시 경유 (브라우저와 동일)  https://elaw-rho.vercel.app
경로 B: 풀백 터널 직접                       https://<fallback>.trycloudflare.com
"""
import sys
import time
from pathlib import Path

import psycopg
import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / "backend" / ".env")

# 풀백 터널 URL 조회
with psycopg.connect(
    dbname=ENV.get("DB_NAME", "postgres"), user=ENV["DB_USER"], password=ENV["DB_PASSWORD"],
    host=ENV["DB_HOST"], port=ENV.get("DB_PORT", "5432"), sslmode="require",
) as conn:
    fallback_url = conn.execute(
        "SELECT url FROM public.infra_endpoint WHERE name='fallback'"
    ).fetchone()[0]

BODY = {"job_role": "백엔드 개발자", "field": "백엔드 (관심 분야: 데이터베이스)", "duration_weeks": 8,
        "topics": ["데이터베이스"]}
SEED = {"email": "minjun.kim@elaw.kr", "password": "elaw1234!"}


def run(label, base, n=5):
    r = requests.post(f"{base}/api/accounts/login/", json=SEED, timeout=120)
    token = r.json()["access"]
    auth = {"Authorization": f"Bearer {token}"}
    for i in range(1, n + 1):
        t = time.time()
        r = requests.post(f"{base}/api/core/goals/", json=BODY, headers=auth, timeout=180)
        print(f"[{label} {i}/{n}] goals POST: {time.time()-t:6.1f}s ({r.status_code})", flush=True)


print("fallback url:", fallback_url)
run("B 터널 직접", fallback_url)
run("A Vercel 경유", "https://elaw-rho.vercel.app")
