"""ELAW 풀백 서버 스모크 테스트 — localhost:9000 기준.

로그인 → 공고 목록 → AI 포트폴리오 생성(202 + 폴링) 전체 경로를 검증한다.
실행(풀백): /volume/elaw/venv/bin/python /volume/elaw/scripts/smoke_test.py
"""
import sys
import time

import requests

BASE = "http://127.0.0.1:9000/api"
SEED = {"email": "minjun.kim@elaw.kr", "password": "elaw1234!"}


def main() -> int:
    # 1) 공고 목록 (비인증)
    r = requests.get(f"{BASE}/jobs/", timeout=30)
    print(f"[1] GET /jobs/ -> {r.status_code}")
    assert r.status_code == 200, r.text[:300]
    jobs = r.json()
    items = jobs.get("data", jobs.get("results", jobs)) if isinstance(jobs, dict) else jobs
    assert items, "공고가 비어 있음"
    posting_id = items[0]["id"]
    print(f"    postings={len(items)} first_id={posting_id}")

    # 2) 시드 계정 로그인
    r = requests.post(f"{BASE}/accounts/login/", json=SEED, timeout=30)
    print(f"[2] POST /accounts/login/ -> {r.status_code}")
    assert r.status_code == 200, r.text[:300]
    token = r.json().get("access") or r.json().get("token")
    assert token, f"토큰 없음: {r.text[:200]}"
    auth = {"Authorization": f"Bearer {token}"}

    # 3) 대시보드 (인증 + 복합 쿼리 — transaction pooler 호환 검증)
    r = requests.get(f"{BASE}/core/dashboard/", headers=auth, timeout=60)
    print(f"[3] GET /core/dashboard/ -> {r.status_code}")
    assert r.status_code == 200, r.text[:300]

    # 4) AI 포트폴리오 생성 (202 + 폴링)
    t0 = time.time()
    payload = {
        "experience": (
            "ELAW 캡스톤 프로젝트에서 Django REST 백엔드와 Next.js 프론트엔드를 개발했고, "
            "Supabase Postgres 마이그레이션과 Ollama 기반 AI 포트폴리오 생성 기능을 구현했습니다."
        )
    }
    r = requests.post(f"{BASE}/jobs/{posting_id}/apply/", headers=auth, json=payload, timeout=30)
    print(f"[4] POST /jobs/{posting_id}/apply/ -> {r.status_code} ({time.time()-t0:.1f}s)")
    assert r.status_code in (200, 201, 202), r.text[:300]
    body = r.json()
    _pf = body.get("data") or body.get("portfolio") or body
    pf_id = _pf.get("id") or body.get("portfolio_id")
    assert pf_id, f"portfolio id 없음: {str(body)[:200]}"

    # 폴링 (최대 5분) — 응답이 data/portfolio로 래핑될 수 있음
    import json as _json

    status = "generating"
    while time.time() - t0 < 300:
        time.sleep(5)
        r = requests.get(f"{BASE}/jobs/portfolios/{pf_id}/", headers=auth, timeout=30)
        d = r.json()
        pf = d.get("data") or d.get("portfolio") or d
        cj = pf.get("content_json") or {}
        if isinstance(cj, str):
            cj = _json.loads(cj or "{}")
        status = cj.get("status", "?")
        print(f"    poll -> {r.status_code} status={status} ({time.time()-t0:.0f}s)")
        if status in ("done", "error"):
            break
    print(f"[4] 포트폴리오 생성 결과: {status} (총 {time.time()-t0:.0f}s)")
    assert status == "done", "생성 실패"

    print("SMOKE_TEST_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
