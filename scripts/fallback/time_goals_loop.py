"""목표 생성 뷰의 단계를 6회 반복하며 단계별 시간 측정 — 간헐 60초 지점 특정.

실행(풀백): cd /volume/elaw/app/backend && PYTHONUTF8=1 \
  /volume/elaw/venv/bin/python manage.py shell < /volume/elaw/scripts/time_goals_loop.py
"""
import time
from datetime import date, timedelta

from core.models import Curriculum, User, UserGoal
from core.views_user import generate_matches_for_user, posting_based_curriculum

u = User.objects.get(email="minjun.kim@elaw.kr")

for i in range(1, 7):
    marks = []

    def lap(name, t0):
        marks.append(f"{name}={time.time()-t0:.2f}s")
        return time.time()

    t = time.time()
    UserGoal.objects.filter(user=u, is_active=True).update(is_active=False)
    t = lap("deactivate", t)
    goal = UserGoal.objects.create(
        user=u, goal_type="job", field="백엔드", job_role="백엔드 개발자",
        duration_weeks=8, start_date=date.today(),
        end_date=date.today() + timedelta(weeks=8),
        mid_eval_date=date.today() + timedelta(weeks=4), is_active=True,
    )
    t = lap("goal_create", t)
    content = posting_based_curriculum(goal)
    t = lap("curriculum_calc", t)
    Curriculum.objects.create(user=u, goal=goal, is_active=True, version=1, content_json=content)
    t = lap("curriculum_save", t)
    generate_matches_for_user(u)
    lap("matches", t)
    print(f"[{i}/6] " + " | ".join(marks), flush=True)

print("DONE")
