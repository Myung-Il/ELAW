# dumpdata JSON 고속 적재 스크립트 (loaddata 대체)
#
# loaddata는 객체마다 save()를 호출해 원격 DB(Supabase)에서는 왕복 지연으로
# 수십 분이 걸린다. 이 스크립트는 모델별 bulk_create(배치 1,000건)로 적재해
# 왕복 횟수를 ~30회로 줄인다.
#
# 전제:
#   · Django의 Postgres FK는 DEFERRABLE INITIALLY DEFERRED → 단일 트랜잭션 안에서
#     적재 순서와 무관하게 커밋 시점에만 FK 검증
#   · 적재 후 시퀀스를 reset (loaddata가 하던 일을 직접 수행)
#
# 사용법: python scripts/fast_loaddata.py backend/backup_sqlite.json

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.core import serializers
from django.core.management.color import no_style
from django.db import connection, transaction


def main():
    if len(sys.argv) < 2:
        sys.exit("사용법: python scripts/fast_loaddata.py <dumpdata.json>")
    path = Path(sys.argv[1])

    print(f"역직렬화 중: {path} ...")
    t0 = time.time()
    with open(path, encoding="utf-8") as f:
        deserialized = list(serializers.deserialize("json", f, ignorenonexistent=True))
    print(f"  {len(deserialized)}개 객체 ({time.time() - t0:.1f}s)")

    # 모델별로 묶되 첫 등장 순서 유지 (FK는 deferred라 순서 자체는 무관)
    groups: dict = {}
    m2m_pending = []
    for d in deserialized:
        groups.setdefault(d.object.__class__, []).append(d.object)
        if d.m2m_data:
            m2m_pending.append(d)

    t0 = time.time()
    with transaction.atomic():
        for model, objs in groups.items():
            model.objects.bulk_create(objs, batch_size=1000)
            print(f"  {model._meta.label:36s}: {len(objs):>6}건")
        # M2M (예: User.groups) — 덤프에 값이 있으면 반영
        for d in m2m_pending:
            for attr, pks in d.m2m_data.items():
                if pks:
                    getattr(d.object, attr).set(pks)
        if m2m_pending:
            print(f"  M2M 반영: {len(m2m_pending)}건")

        # 명시적 PK로 적재했으므로 시퀀스 리셋 필수
        seq_sql = connection.ops.sequence_reset_sql(no_style(), list(groups.keys()))
        with connection.cursor() as cur:
            for sql in seq_sql:
                cur.execute(sql)
        print(f"  시퀀스 리셋: {len(seq_sql)}개")

    print(f"완료 ({time.time() - t0:.1f}s)")


if __name__ == "__main__":
    main()
