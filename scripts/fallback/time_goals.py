"""목표 생성 경로의 단계별 소요 시간 실측 (manage.py shell 용).

실행(풀백): cd /volume/elaw/app/backend && PYTHONUTF8=1 \
  /volume/elaw/venv/bin/python manage.py shell < /volume/elaw/scripts/time_goals.py
"""
import time

from django.db import connection

from core.models import User, UserGoal
from core.views_user import (
    generate_matches_for_user,
    posting_based_curriculum,
    resolve_posting_job_role,
)

# 0) 단일 쿼리 왕복(RTT) 기준치
t = time.time()
for _ in range(5):
    with connection.cursor() as cur:
        cur.execute("SELECT 1")
        cur.fetchone()
print(f"[0] SELECT 1 x5: {time.time()-t:.2f}s (회당 {(time.time()-t)/5*1000:.0f}ms)")

u = User.objects.get(email="minjun.kim@elaw.kr")
goal = UserGoal.objects.filter(user=u, is_active=True).first() or UserGoal.objects.filter(user=u).first()
print(f"    user={u.id} goal={goal.id if goal else None} job_role={goal.job_role if goal else '?'}")

# 1) 직무명 해석
t = time.time()
role = resolve_posting_job_role(goal.job_role)
print(f"[1] resolve_posting_job_role: {time.time()-t:.2f}s → {role}")

# 2) 공고 기반 커리큘럼 생성
t = time.time()
content = posting_based_curriculum(goal)
print(f"[2] posting_based_curriculum: {time.time()-t:.2f}s (weeks={content.get('total_weeks')})")

# 3) 전체 공고 매칭 점수 계산 (목표 생성 시 동기 실행되는 부분)
t = time.time()
generate_matches_for_user(u)
print(f"[3] generate_matches_for_user: {time.time()-t:.2f}s")

print("DONE")
