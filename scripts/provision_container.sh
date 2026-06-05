#!/bin/bash
# ELAW 컨테이너 전체 재프로비저닝 스크립트
# 용도: 컨테이너가 재생성(이미지로부터 새로 시작)되어 apt 설치물이 사라졌을 때 복구.
#       데이터(/volume/ELAW/data, backups)와 코드는 NFS 볼륨이라 보존됨.
# 실행: bash /volume/ELAW/scripts/provision_container.sh
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
S=/volume/ELAW/scripts

echo "=== [1/6] PostgreSQL 16 (기존 데이터 디렉토리 재등록 포함) ==="
bash "$S/provision_postgres.sh"

echo "=== [2/6] nginx + cron ==="
apt-get install -y -qq nginx cron >/dev/null
rm -f /etc/nginx/sites-enabled/default
service nginx stop 2>/dev/null || true
ln -sf "$S/nginx_elaw.conf" /etc/nginx/sites-enabled/elaw
nginx -t

echo "=== [3/6] supervisord 구성 ==="
apt-get install -y -qq supervisor >/dev/null
cp "$S/supervisord_elaw.conf" /etc/supervisor/conf.d/elaw.conf
service supervisor start 2>/dev/null || /usr/bin/supervisord -c /etc/supervisor/supervisord.conf 2>/dev/null || true
supervisorctl reread && supervisorctl update

echo "=== [4/6] crontab (백업 + 로그 로테이션) ==="
( crontab -l 2>/dev/null | grep -v 'ELAW-ops' ;
  echo "30 18 * * * bash /volume/ELAW/scripts/backup_db.sh # ELAW-ops backup (03:30 KST)" ;
  echo "0 19 * * * /usr/sbin/logrotate -s /volume/ELAW/logs/logrotate.state /volume/ELAW/scripts/logrotate_elaw.conf # ELAW-ops logrotate (04:00 KST)" ) | crontab -
crontab -l | grep ELAW-ops

echo "=== [5/6] 부팅 훅 (run_jupyter.sh) ==="
if ! grep -q "ELAW 부팅 훅" /run_jupyter.sh; then
  cp /run_jupyter.sh /run_jupyter.sh.bak
  sed -i '1a\
# ── ELAW 부팅 훅: 컨테이너 재시작 시 ssh + supervisor 자동 기동 ──\
service ssh start >/dev/null 2>&1 || /usr/sbin/sshd >/dev/null 2>&1 || true\
service supervisor start >/dev/null 2>&1 || /usr/bin/supervisord -c /etc/supervisor/supervisord.conf >/dev/null 2>&1 || true' /run_jupyter.sh
fi

echo "=== [6/6] 상태 확인 ==="
sleep 8
supervisorctl status
echo "프로비저닝 완료. 프론트엔드 빌드가 없다면: cd /volume/ELAW/frontend && npm install && NEXT_PUBLIC_API_URL=http://127.0.0.1:9002 API_URL=http://127.0.0.1:9002 npm run build"
