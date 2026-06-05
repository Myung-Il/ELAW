#!/usr/bin/env bash
# ELAW CI 배포 스크립트 (컨테이너 통합 스택용 — /volume/deploy.sh 교체본)
# ⚠️ 적용 시점: container-migration → main 병합(전환 완료) 후 runner 재개와 함께.
#    적용 방법: cp /volume/ELAW/scripts/deploy_container.sh /volume/deploy.sh
# ⚠️ reset --hard는 /volume/ELAW의 미커밋 변경을 삭제한다 — 수동 작업은 반드시 커밋 후 푸시할 것.
set -euo pipefail

APP_DIR="/volume/ELAW"
BRANCH="main"
PY="$APP_DIR/.venv/bin/python"
PIP="$APP_DIR/.venv/bin/pip"
API=http://127.0.0.1:9002

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# 백엔드
"$PIP" install -r requirements.txt -q
cd "$APP_DIR/backend"
"$PY" manage.py migrate --noinput
"$PY" manage.py collectstatic --noinput >/dev/null

# 프론트엔드
cd "$APP_DIR/frontend"
npm install --no-audit --no-fund
NEXT_PUBLIC_API_URL=$API API_URL=$API npm run build

# 재기동 (postgres/ollama/nginx는 유지 — 코드 변경분만)
supervisorctl restart elaw_backend elaw_frontend
sleep 5

for svc in elaw_backend elaw_frontend; do
  supervisorctl status "$svc" | grep -q RUNNING || { echo "FAIL: $svc not running"; exit 1; }
done
curl -sf -o /dev/null http://127.0.0.1/ || { echo "FAIL: nginx smoke test"; exit 1; }
echo "Deploy OK."
