#!/bin/bash
# 백업 복원 리허설 — 최신 덤프를 임시 DB(elaw_restore_test)에 복원해 검증 (운영 DB 무영향)
set -euo pipefail
BK=/volume/ELAW/backups
LATEST=$(ls -t "$BK"/elaw_*.dump 2>/dev/null | head -1)
[ -n "$LATEST" ] || { echo "FATAL: 백업 파일 없음"; exit 1; }
echo "대상: $LATEST"

su -s /bin/bash postgres -c "dropdb --if-exists elaw_restore_test && createdb -O elaw elaw_restore_test"
su -s /bin/bash postgres -c "pg_restore -d elaw_restore_test --no-owner --role=elaw '$LATEST'" 2>&1 | tail -3 || true

echo "--- 검증: 테이블 수 / 핵심 행 수 ---"
su -s /bin/bash postgres -c "psql -d elaw_restore_test -tAc \"SELECT count(*) || ' tables' FROM information_schema.tables WHERE table_schema='public'\""
su -s /bin/bash postgres -c "psql -d elaw_restore_test -tAc \"SELECT 'users: ' || count(*) FROM core_user\""
su -s /bin/bash postgres -c "psql -d elaw_restore_test -tAc \"SELECT 'problems: ' || count(*) FROM job_problems\""
su -s /bin/bash postgres -c "dropdb elaw_restore_test"
echo "리허설 완료 — 임시 DB 정리됨 ✅"
