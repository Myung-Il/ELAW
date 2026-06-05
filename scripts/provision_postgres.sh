#!/bin/bash
# PostgreSQL 16 설치 + /volume/ELAW/data/postgres 클러스터 생성
# 컨테이너 재생성 시에도 이 스크립트 재실행으로 복구 (데이터는 /volume이라 보존됨)
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
PGDATA=/volume/ELAW/data/postgres
PGVER=16

echo "[1/5] apt 준비..."
apt-get update -qq 2>&1 | tail -1
apt-get install -y -qq curl ca-certificates gnupg lsb-release >/dev/null 2>&1

echo "[2/5] PGDG 저장소 등록..."
install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc

# focal은 표준지원 종료 → 본 저장소 404 시 아카이브로 폴백
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt focal-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
if ! apt-get update -o Dir::Etc::sourcelist=/etc/apt/sources.list.d/pgdg.list -o Dir::Etc::sourceparts=- -qq 2>/dev/null; then
  echo "  (본 저장소 실패 → apt-archive 폴백)"
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt-archive.postgresql.org/pub/repos/apt focal-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq 2>&1 | tail -1
fi

echo "[3/5] postgresql-$PGVER 설치..."
if ! apt-get install -y -qq postgresql-$PGVER >/dev/null; then
  echo "  PGDG 설치 실패 → 배포판 기본 postgresql(12)로 폴백"
  PGVER=12
  apt-get install -y -qq postgresql >/dev/null || { echo "FATAL: postgresql 설치 실패"; exit 1; }
fi
echo "  설치됨: $(ls /usr/lib/postgresql/)"

echo "[4/5] 클러스터를 $PGDATA 에 생성..."
# apt가 만든 기본 클러스터(/var/lib) 제거 후 /volume에 재생성
pg_dropcluster --stop $PGVER main 2>/dev/null || true
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  # UTF-8 필수 — 기본 locale C는 SQL_ASCII가 되어 한국어 데이터가 깨짐
  pg_createcluster -d "$PGDATA" -p 5432 $PGVER main -- --encoding=UTF8 --locale=C.UTF-8 || { echo "FATAL: initdb 실패 (NFS 이슈 가능성)"; exit 1; }
else
  echo "  기존 데이터 디렉토리 발견 → 클러스터 등록만 수행"
  pg_createcluster -d "$PGDATA" -p 5432 $PGVER main 2>/dev/null || true
fi
sed -i "s/^#\?listen_addresses.*/listen_addresses = '127.0.0.1'/" /etc/postgresql/$PGVER/main/postgresql.conf

echo "[5/5] 기동..."
pg_ctlcluster $PGVER main start
pg_lsclusters
su -s /bin/bash postgres -c "psql -c 'SELECT version();'" | head -3
