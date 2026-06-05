"""generate_matches_for_user의 쿼리를 개별 측정 — 간헐 60초 쿼리 특정.

실행(풀백): cd /volume/elaw/app/backend && PYTHONUTF8=1 \
  /volume/elaw/venv/bin/python manage.py shell < /volume/elaw/scripts/time_queries.py
"""
import time

from core.models import JobPosting, LearningStats, Match, PlatformLink, User

u = User.objects.get(email="minjun.kim@elaw.kr")

for i in range(1, 9):
    marks = []

    t = time.time()
    list(LearningStats.objects.filter(user=u, stat_type__in=["language", "algo_tag"])
         .values_list("stat_type", "stat_key"))
    marks.append(f"stats={time.time()-t:.2f}s")

    t = time.time()
    list(PlatformLink.objects.filter(user=u, is_active=True))
    marks.append(f"links={time.time()-t:.2f}s")

    t = time.time()
    postings = list(JobPosting.objects.filter(is_active=True).select_related("company"))
    marks.append(f"postings({len(postings)})={time.time()-t:.2f}s")

    t = time.time()
    list(Match.objects.filter(user=u))
    marks.append(f"matches={time.time()-t:.2f}s")

    print(f"[{i}/8] " + " | ".join(marks), flush=True)

print("DONE")
