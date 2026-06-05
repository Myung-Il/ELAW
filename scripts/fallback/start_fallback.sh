#!/usr/bin/env bash
# ELAW 풀백 스택 기동 스크립트
# 위치(풀백): /volume/elaw/scripts/start_fallback.sh
# 컨테이너가 재시작된 뒤에는 이 스크립트만 다시 실행하면 된다.
set -euo pipefail

BASE=/volume/elaw
CONF=$BASE/scripts/supervisord.conf
CTL="$BASE/venv/bin/supervisorctl -c $CONF"

# 이미 떠 있으면 상태만 출력
if [ -S "$BASE/runtime/supervisor.sock" ] && $CTL status >/dev/null 2>&1; then
    echo "[start_fallback] supervisord already running:"
    $CTL status
    exit 0
fi

echo "[start_fallback] starting supervisord..."
"$BASE/venv/bin/supervisord" -c "$CONF"
sleep 3
$CTL status
echo "[start_fallback] done. logs: $BASE/logs/"
