"""
python manage.py seed_all

12개 테이블 전체에 릴레이션 인스턴스를 채우는 시드 커맨드.
- User 15명 (학생10 + 기업3 + 관리자2), 기존 test@elaw.kr 포함
- Company 3개
- PlatformLink (학생 1인당 백준+GitHub)
- UserGoal
- Curriculum (JSON)
- SolveHistory (학생별 20~40문제)
- LearningStats (언어/태그 집계)
- Portfolio
- JobPosting 6개
- Match (학생-공고 매칭)
- Post 5개
- AiLog 10개
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
import json, random, uuid
from datetime import timedelta, date


class Command(BaseCommand):
    help = "12개 테이블 전체 시드 데이터 생성"

    def handle(self, *args, **options):
        self.stdout.write("🌱 시드 데이터 생성 시작...\n")
        self._seed_users()
        self._seed_companies()
        self._seed_platform_links()
        self._seed_user_goals()
        self._seed_curricula()
        self._seed_solve_history()
        self._rebuild_stats()
        self._seed_portfolios()
        self._seed_job_postings()
        self._seed_matches()
        self._seed_posts()
        self._seed_ai_logs()
        self.stdout.write(self.style.SUCCESS("\n✅ 시드 데이터 생성 완료!"))

    # ────────────────────────────────────────
    # 1. Users (15명)
    # ────────────────────────────────────────
    def _seed_users(self):
        from core.models import User
        self.stdout.write("  👤 사용자 생성 중...")

        students = [
            ("김민준", "minjun.kim@elaw.kr",   "student"),
            ("이서연", "seoyeon.lee@elaw.kr",   "student"),
            ("박지호", "jiho.park@elaw.kr",     "student"),
            ("최수아", "sua.choi@elaw.kr",       "student"),
            ("정도윤", "doyun.jung@elaw.kr",     "student"),
            ("강하은", "haeun.kang@elaw.kr",     "student"),
            ("윤재원", "jaewon.yoon@elaw.kr",    "student"),
            ("임소율", "soyul.lim@elaw.kr",      "student"),
            ("한준서", "junseo.han@elaw.kr",     "student"),
            ("오성환", "seonghwan.oh@elaw.kr",   "student"),  # 실제 사용자
        ]
        companies = [
            ("카카오 채용팀", "recruit@kakao.elaw.kr",   "company"),
            ("네이버 인사팀", "hr@naver.elaw.kr",        "company"),
            ("라인 채용팀",   "recruit@line.elaw.kr",    "company"),
        ]
        admins = [
            ("관리자1", "admin1@elaw.kr", "admin"),
            ("관리자2", "admin2@elaw.kr", "admin"),
        ]

        self.users   = {}
        self.companies_users = []
        self.student_users   = []

        for name, email, role in students + companies + admins:
            if User.objects.filter(email=email).exists():
                u = User.objects.get(email=email)
            else:
                u = User.objects.create_user(
                    email=email, password="elaw1234!",
                    name=name, role=role,
                    ai_consent=True, privacy_consent=True,
                )
            self.users[email] = u
            if role == "student":
                self.student_users.append(u)
            elif role == "company":
                self.companies_users.append(u)

        self.stdout.write(f"    → {len(self.users)}명 완료")

    # ────────────────────────────────────────
    # 2. Companies
    # ────────────────────────────────────────
    def _seed_companies(self):
        from core.models import Company
        self.stdout.write("  🏢 기업 정보 생성 중...")

        company_data = [
            ("카카오", "IT/플랫폼", "국내 1위 메신저 카카오 채용",
             "https://kakao.com", "https://recruit.kakao.com"),
            ("네이버", "IT/검색", "국내 최대 포털 네이버 채용",
             "https://naver.com", "https://recruit.naver.com"),
            ("라인", "IT/글로벌", "글로벌 메신저 라인 채용",
             "https://linecorp.com", "https://careers.linecorp.com"),
        ]

        self.company_objs = []
        for i, cu in enumerate(self.companies_users):
            name, industry, desc, website, _ = company_data[i]
            obj, _ = Company.objects.get_or_create(
                user=cu,
                defaults=dict(
                    name=name, industry=industry,
                    description=desc, website_url=website,
                    is_approved=True, approved_at=timezone.now(),
                ),
            )
            self.company_objs.append(obj)

        self.stdout.write(f"    → {len(self.company_objs)}개 완료")

    # ────────────────────────────────────────
    # 3. PlatformLinks
    # ────────────────────────────────────────
    def _seed_platform_links(self):
        from core.models import PlatformLink
        self.stdout.write("  🔗 플랫폼 연동 생성 중...")

        # 가상 백준/GitHub 아이디 (학생별)
        handles = [
            ("bj_minjun",   "github-minjun"),
            ("bj_seoyeon",  "github-seoyeon"),
            ("bj_jiho",     "github-jiho"),
            ("bj_sua",      "github-sua"),
            ("bj_doyun",    "github-doyun"),
            ("bj_haeun",    "github-haeun"),
            ("bj_jaewon",   "github-jaewon"),
            ("bj_soyul",    "github-soyul"),
            ("bj_junseo",   "github-junseo"),
            ("mango538",    "Ohseonghwan538"),   # 실제 사용자
        ]

        self.platform_links = []
        for i, student in enumerate(self.student_users):
            bj_id, gh_id = handles[i]
            for platform, ext_id in [("baekjoon", bj_id), ("github", gh_id)]:
                obj, _ = PlatformLink.objects.get_or_create(
                    user=student, platform=platform,
                    defaults=dict(
                        external_id=ext_id,
                        is_active=True,
                        last_synced=timezone.now() - timedelta(hours=random.randint(1,24)),
                    ),
                )
                self.platform_links.append(obj)

        self.stdout.write(f"    → {len(self.platform_links)}개 완료")

    # ────────────────────────────────────────
    # 4. UserGoals
    # ────────────────────────────────────────
    def _seed_user_goals(self):
        from core.models import UserGoal
        self.stdout.write("  🎯 학습 목표 생성 중...")

        fields    = ["백엔드", "프론트엔드", "AI/ML", "데이터분석", "풀스택"]
        job_roles = ["백엔드 개발자", "프론트엔드 개발자", "AI 엔지니어",
                     "데이터 분석가", "풀스택 개발자"]

        self.goal_objs = []
        for i, student in enumerate(self.student_users):
            obj, _ = UserGoal.objects.get_or_create(
                user=student, is_active=True,
                defaults=dict(
                    goal_type="job",
                    field=fields[i % len(fields)],
                    job_role=job_roles[i % len(job_roles)],
                    start_date=date.today() - timedelta(weeks=4),
                    end_date=date.today() + timedelta(weeks=12),
                    duration_weeks=16,
                ),
            )
            self.goal_objs.append(obj)

        self.stdout.write(f"    → {len(self.goal_objs)}개 완료")

    # ────────────────────────────────────────
    # 5. Curricula
    # ────────────────────────────────────────
    def _seed_curricula(self):
        from core.models import Curriculum
        self.stdout.write("  📚 커리큘럼 생성 중...")

        count = 0
        for i, (student, goal) in enumerate(zip(self.student_users, self.goal_objs)):
            if Curriculum.objects.filter(user=student, is_active=True).exists():
                continue
            Curriculum.objects.create(
                user=student, goal=goal,
                is_active=True, version=1,
                content_json={
                    "total_weeks": 8,
                    "field": goal.field,
                    "job_role": goal.job_role,
                    "weeks": [
                        {
                            "week": w,
                            "theme": f"{goal.field} {w}주차 학습",
                            "tasks": ["개념 학습", "문제 풀이", "코드 리뷰"],
                            "recommended_problems": [
                                str(1000 + w * 10 + i),
                                str(2000 + w * 5  + i),
                            ],
                            "estimated_hours": 8,
                        }
                        for w in range(1, 9)
                    ],
                },
            )
            count += 1

        self.stdout.write(f"    → {count}개 생성 완료")

    # ────────────────────────────────────────
    # 6. SolveHistory
    # ────────────────────────────────────────
    def _seed_solve_history(self):
        from core.models import SolveHistory
        self.stdout.write("  📝 풀이 이력 생성 중...")

        PROBLEMS = [
            ("1000","A+B","Bronze5",["구현","수학"]),
            ("1001","A-B","Bronze5",["구현","수학"]),
            ("2557","Hello World","Bronze5",["구현"]),
            ("2750","수 정렬하기","Bronze2",["정렬"]),
            ("1181","단어 정렬","Silver5",["정렬","문자열"]),
            ("10828","스택","Silver4",["스택","자료구조"]),
            ("10845","큐","Silver4",["큐","자료구조"]),
            ("1260","DFS와 BFS","Silver2",["그래프","BFS","DFS"]),
            ("2178","미로 탐색","Silver1",["BFS","그래프"]),
            ("1463","1로 만들기","Silver3",["DP"]),
            ("9095","1,2,3 더하기","Silver3",["DP"]),
            ("11053","가장 긴 증가하는 부분 수열","Silver2",["DP"]),
            ("1920","수 찾기","Silver4",["이분탐색"]),
            ("2805","나무 자르기","Silver2",["이분탐색","그리디"]),
            ("11047","동전 0","Silver1",["그리디"]),
            ("1931","회의실 배정","Silver1",["그리디","정렬"]),
            ("1927","최소 힙","Silver2",["자료구조","힙"]),
            ("1991","트리 순회","Silver1",["트리"]),
            ("1197","최소 스패닝 트리","Gold4",["그래프","MST"]),
            ("1753","최단경로","Gold4",["그래프","최단경로"]),
            ("9663","N-Queen","Gold4",["백트래킹"]),
            ("2579","계단 오르기","Silver3",["DP"]),
            ("1012","유기농 배추","Silver2",["DFS","그래프"]),
            ("11724","연결 요소의 개수","Silver2",["그래프","BFS","DFS"]),
            ("1389","케빈 베이컨의 6단계 법칙","Silver1",["BFS","그래프"]),
        ]
        LANGS = ["Python","Python","Java","JavaScript","Python",
                 "C++","Python","Java","Python","Python"]

        count = 0
        random.seed(42)
        for i, student in enumerate(self.student_users):
            lang = LANGS[i % len(LANGS)]
            problems = PROBLEMS.copy()
            random.shuffle(problems)
            for pid, title, diff, tags in problems[:random.randint(20,25)]:
                solved_at = timezone.now() - timedelta(
                    days=random.randint(0,60),
                    hours=random.randint(0,23)
                )
                status = "failed" if random.random() < 0.15 else "solved"
                _, created = SolveHistory.objects.get_or_create(
                    user=student, platform="baekjoon", problem_id=pid,
                    defaults=dict(
                        problem_title=title, status=status,
                        language=lang, algo_tags=tags,
                        difficulty=diff, solved_at=solved_at,
                        source="api",
                    ),
                )
                if created:
                    count += 1

        self.stdout.write(f"    → {count}건 완료")

    # ────────────────────────────────────────
    # 7. LearningStats (집계)
    # ────────────────────────────────────────
    def _rebuild_stats(self):
        from core.models import SolveHistory, LearningStats
        self.stdout.write("  📊 학습 통계 집계 중...")

        count = 0
        for student in self.student_users:
            rows = SolveHistory.objects.filter(user=student)

            # 언어별
            lang_map = {}
            for r in rows:
                if not r.language:
                    continue
                lang_map.setdefault(r.language, {"total":0,"solved":0})
                lang_map[r.language]["total"] += 1
                if r.status == "solved":
                    lang_map[r.language]["solved"] += 1

            for lang, c in lang_map.items():
                rate = round(c["solved"]/c["total"]*100, 2) if c["total"] else 0
                LearningStats.objects.update_or_create(
                    user=student, stat_type="language", stat_key=lang,
                    defaults=dict(total_count=c["total"], solved_count=c["solved"],
                                  correct_rate=rate),
                )
                count += 1

            # 태그별
            tag_map = {}
            for r in rows:
                for tag in (r.algo_tags or []):
                    tag_map.setdefault(tag, {"total":0,"solved":0})
                    tag_map[tag]["total"] += 1
                    if r.status == "solved":
                        tag_map[tag]["solved"] += 1

            for tag, c in tag_map.items():
                rate = round(c["solved"]/c["total"]*100, 2) if c["total"] else 0
                LearningStats.objects.update_or_create(
                    user=student, stat_type="algo_tag", stat_key=tag,
                    defaults=dict(total_count=c["total"], solved_count=c["solved"],
                                  correct_rate=rate),
                )
                count += 1

        self.stdout.write(f"    → {count}개 통계 완료")

    # ────────────────────────────────────────
    # 8. Portfolios
    # ────────────────────────────────────────
    def _seed_portfolios(self):
        from core.models import Portfolio
        self.stdout.write("  🗂️  포트폴리오 생성 중...")

        count = 0
        for student in self.student_users:
            if Portfolio.objects.filter(user=student).exists():
                continue
            Portfolio.objects.create(
                user=student,
                title=f"{student.name}의 포트폴리오",
                summary_text=f"{student.name}은 알고리즘과 웹 개발에 관심 있는 개발자입니다.",
                public_slug=str(uuid.uuid4())[:8],
                is_public=True,
                content_json={
                    "sections": [
                        {"type":"summary","title":"자기소개",
                         "content":f"{student.name}입니다. 열심히 공부 중입니다."},
                        {"type":"skills","title":"기술 스택",
                         "items":["Python","Django","SQL","Git"]},
                        {"type":"stats","title":"학습 현황",
                         "solve_count": random.randint(50,300)},
                    ]
                },
            )
            count += 1

        self.stdout.write(f"    → {count}개 완료")

    # ────────────────────────────────────────
    # 9. JobPostings
    # ────────────────────────────────────────
    def _seed_job_postings(self):
        from core.models import JobPosting
        self.stdout.write("  💼 채용공고 생성 중...")

        postings = [
            ("백엔드 개발자 (Python/Django)", ["Python","Django","MySQL"], ["Redis","Docker"], "백엔드 개발자", "new"),
            ("프론트엔드 개발자 (React)", ["JavaScript","React","HTML/CSS"], ["TypeScript","Next.js"], "프론트엔드 개발자", "new"),
            ("AI 엔지니어", ["Python","PyTorch","ML"], ["TensorFlow","Docker"], "AI 엔지니어", "junior"),
            ("데이터 분석가", ["Python","SQL","Pandas"], ["Tableau","Spark"], "데이터 분석가", "any"),
            ("풀스택 개발자", ["Python","JavaScript","React","Django"], ["Docker","AWS"], "풀스택 개발자", "junior"),
            ("서버 개발자 (Java)", ["Java","Spring","MySQL"], ["Redis","Kafka"], "백엔드 개발자", "junior"),
        ]

        self.posting_objs = []
        for i, (title, req, pref, role, level) in enumerate(postings):
            company = self.company_objs[i % len(self.company_objs)]
            obj, _ = JobPosting.objects.get_or_create(
                company=company, title=title,
                defaults=dict(
                    required_skills=req,
                    preferred_skills=pref,
                    job_role=role,
                    career_level=level,
                    deadline=date.today() + timedelta(days=30+i*5),
                    is_active=True,
                    description=f"{title} 포지션을 모집합니다.",
                ),
            )
            self.posting_objs.append(obj)

        self.stdout.write(f"    → {len(self.posting_objs)}개 완료")

    # ────────────────────────────────────────
    # 10. Matches
    # ────────────────────────────────────────
    def _seed_matches(self):
        from core.models import Match
        self.stdout.write("  🤝 매칭 데이터 생성 중...")

        statuses = ["recommended","viewed","scrapped","applied","rejected"]
        count = 0
        for student in self.student_users:
            for posting in random.sample(self.posting_objs, k=min(3, len(self.posting_objs))):
                _, created = Match.objects.get_or_create(
                    user=student, posting=posting,
                    defaults=dict(
                        match_score=round(random.uniform(40, 95), 1),
                        status=random.choice(statuses),
                    ),
                )
                if created:
                    count += 1

        self.stdout.write(f"    → {count}개 완료")

    # ────────────────────────────────────────
    # 11. Posts
    # ────────────────────────────────────────
    def _seed_posts(self):
        from core.models import Post
        self.stdout.write("  📢 게시글 생성 중...")

        posts_data = [
            ("notice",  "ELAW 플랫폼 오픈 안내",        "ELAW가 공식 오픈되었습니다. 많은 이용 부탁드립니다.", True),
            ("contest", "2026 상반기 코딩테스트 일정",   "주요 기업 코딩테스트 일정을 안내합니다.", False),
            ("notice",  "시스템 점검 안내 (3/30)",       "3월 30일 새벽 2시~4시 시스템 점검 예정입니다.", True),
            ("event",   "신규 가입 이벤트",              "3월 한 달간 신규 가입 시 AI 커리큘럼 무료 제공!", False),
            ("contest", "카카오 2026 공채 일정 안내",    "카카오 공개채용 코딩테스트 접수 안내입니다.", False),
        ]

        admin_user = next(u for u in self.users.values() if u.role == "admin")
        count = 0
        for category, title, content, pinned in posts_data:
            _, created = Post.objects.get_or_create(
                title=title,
                defaults=dict(
                    author=admin_user, category=category,
                    content=content, is_pinned=pinned,
                    view_count=random.randint(10,200),
                ),
            )
            if created:
                count += 1

        self.stdout.write(f"    → {count}개 완료")

    # ────────────────────────────────────────
    # 12. AiLogs
    # ────────────────────────────────────────
    def _seed_ai_logs(self):
        from core.models import AiLog
        self.stdout.write("  🤖 AI 로그 생성 중...")

        features = ["curriculum","weakness","recommendation","portfolio","matching"]
        count = 0
        for student in self.student_users[:5]:
            for feature in random.sample(features, k=2):
                AiLog.objects.create(
                    user=student,
                    feature=feature,
                    prompt_tokens=random.randint(200,800),
                    output_tokens=random.randint(100,500),
                    latency_ms=random.randint(800,3000),
                    status="success",
                )
                count += 1

        self.stdout.write(f"    → {count}개 완료")
