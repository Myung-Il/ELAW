#!/bin/bash
# ELAW DB 일일 백업 — root crontab에서 실행 (03:30 KST)
# 보관: 14일. 복원 절차는 docs/CONTAINER_OPERATIONS.md 참고.
set -euo pipefail
BK=/volume/ELAW/backups
mkdir -p "$BK"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BK/elaw_$STAMP.dump"

su -s /bin/bash postgres -c "pg_dump -Fc -d elaw" > "$OUT"

# 무결성 1차 확인: 아카이브 목차가 읽히는지
su -s /bin/bash postgres -c "pg_restore -l '$OUT'" > /dev/null

find "$BK" -name 'elaw_*.dump' -mtime +14 -delete
echo "$(date -Is) OK $OUT ($(du -h "$OUT" | cut -f1))" >> "$BK/backup.log"
