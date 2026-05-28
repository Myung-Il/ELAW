"""
python manage.py fill_tables

실제 데이터 기반으로 비어있는 테이블을 채우는 커맨드.
- Curriculum  : Gemini API 실제 호출 → AI 생성 커리큘럼 + AiLog 자동 기록
- Company     : 실제 기업과 유사한 형태 (카카오/네이버/라인플러스)
- JobPosting  : 실제 2026 상반기 공고 형태
- Match       : 오성환 실제 스킬 기반 점수 계산
- Post        : 실제 운영 예정 내용
"""

import time, json, random, requests
from datetime import timedelta, date
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone


class Command(BaseCommand):
    help = "비어있는 테이블을 실제 데이터 기반으로 채우기"

    def handle(self, *args, **options):
        from core.models import User
        try:
            self.student = User.objects.get(email="mango2410@mokpo.ac.kr")
        except User.DoesNotExist:
            self.stderr.write("오성환 계정을 찾을 수 없습니다."); return
        try:
            self.admin = User.objects.get(role="root")
        except User.DoesNotExist:
            self.admin = self.student

        self.gemini_key = getattr(settings, "GEMINI_API_KEY", "")
        self.stdout.write(f"✅ 사용자: {self.student.name} ({self.student.email})")
        self.stdout.write(f"✅ Gemini API: {'연결됨' if self.gemini_key else '❌ 없음'}\n")

        self._fill_companies()
        self._fill_job_postings()
        self._fill_curriculum_with_gemini()
        self._fill_matches()
        self._fill_posts()
        self._print_summary()

    def _call_gemini(self, prompt, feature):
        from core.models import AiLog
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={self.gemini_key}"
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
        }
        start = time.time()
        status, result_text, error_msg = "success", "", None
        try:
            resp = requests.post(url, json=body, timeout=30)
            resp.raise_for_status()
            result_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            status = "error"; error_msg = str(e)[:500]
            self.stderr.write(f"   Gemini 오류: {e}")
        latency_ms = int((time.time() - start) * 1000)
        AiLog.objects.create(
            user=self.student, feature=feature,
            prompt_tokens=len(prompt.split()),
            output_tokens=len(result_text.split()) if result_text else 0,
            latency_ms=latency_ms, status=status, error_message=error_msg,
        )
        return result_text if status == "success" else None

    def _fill_companies(self):
        from core.models import User, Company
        self.stdout.write("🏢 기업 계정 생성 중...")
        data = [
            ("카카오 채용팀", "recruit@kakao.elaw.kr", "카카오", "IT/플랫폼",
             "카카오는 카카오톡, 카카오페이, 카카오맵 등 다양한 플랫폼 서비스를 운영하는 "
             "국내 대표 IT 기업입니다. 2026 상반기 신입/경력 개발자를 모집합니다.",
             "https://kakao.com"),
            ("네이버 인사팀", "hr@naver.elaw.kr", "네이버", "IT/검색포털",
             "네이버는 검색, 쇼핑, 클라우드, AI 등 다양한 서비스를 운영하는 "
             "국내 최대 포털 기업입니다. 하이퍼클로바X 등 AI 분야를 선도합니다.",
             "https://naver.com"),
            ("라인플러스 채용팀", "recruit@lineplus.elaw.kr", "라인플러스", "IT/글로벌메신저",
             "라인플러스는 글로벌 메신저 LINE을 운영하는 네이버 자회사로, "
             "일본·동남아 등 글로벌 시장에서 서비스를 제공합니다.",
             "https://linecorp.com"),
        ]
        self.company_objs = []
        for uname, email, cname, industry, desc, website in data:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults=dict(name=uname, role="company", ai_consent=True, privacy_consent=True),
            )
            if not user.has_usable_password():
                user.set_password("elaw1234!"); user.save()
            company, created = Company.objects.get_or_create(
                user=user,
                defaults=dict(name=cname, industry=industry, description=desc,
                              website_url=website, is_approved=True, approved_at=timezone.now()),
            )
            self.company_objs.append(company)
            self.stdout.write(f"   [{cname}] — {'신규 생성' if created else '이미 존재'}")

    def _fill_job_postings(self):
        from core.models import JobPosting
        self.stdout.write("\n💼 채용공고 생성 중...")
        postings = [
            (0, "카카오 2026 신입 풀스택 개발자",
             "카카오 서비스의 백엔드/프론트엔드를 개발할 풀스택 개발자를 모집합니다.",
             ["Python","React","MySQL","REST API","Git"], ["Django","TypeScript","Docker","AWS","Redis"],
             "풀스택 개발자", "new", 30),
            (0, "카카오 2026 신입 백엔드 개발자 (Python)",
             "카카오 플랫폼 서비스의 백엔드 시스템을 개발합니다.",
             ["Python","Django","MySQL","Linux","Git"], ["FastAPI","Redis","Kafka","Kubernetes"],
             "백엔드 개발자", "new", 25),
            (1, "네이버 2026 신입 AI 서비스 개발자",
             "하이퍼클로바X 기반 AI 서비스를 개발합니다.",
             ["Python","REST API","Git","Linux"], ["PyTorch","LLM","Docker","FastAPI","MLflow"],
             "AI 엔지니어", "new", 40),
            (1, "네이버 2026 신입 데이터 엔지니어",
             "네이버 서비스 데이터 파이프라인을 설계하고 운영합니다.",
             ["Python","SQL","Linux","Git"], ["Spark","Airflow","Kafka","AWS","Hadoop"],
             "데이터 엔지니어", "new", 35),
            (2, "라인플러스 2026 신입 서버 개발자 (Java)",
             "LINE 글로벌 서비스의 서버 시스템을 개발합니다.",
             ["Java","Spring","MySQL","REST API","Git"], ["Kotlin","Redis","Kafka","gRPC","Docker"],
             "백엔드 개발자", "new", 20),
            (2, "라인플러스 2026 신입 프론트엔드 개발자",
             "LINE 앱 및 웹 서비스의 프론트엔드를 개발합니다.",
             ["JavaScript","React","HTML","CSS","Git"], ["TypeScript","Next.js","GraphQL","Webpack","Jest"],
             "프론트엔드 개발자", "new", 45),
        ]
        self.posting_objs = []
        for cidx, title, desc, req, pref, role, level, days in postings:
            company = self.company_objs[cidx]
            obj, created = JobPosting.objects.get_or_create(
                company=company, title=title,
                defaults=dict(description=desc, required_skills=req, preferred_skills=pref,
                              job_role=role, career_level=level,
                              deadline=date.today()+timedelta(days=days),
                              is_active=True, view_count=random.randint(80,500)),
            )
            self.posting_objs.append(obj)
            self.stdout.write(f"   [{company.name}] {title[:38]} — {'신규' if created else '이미 존재'}")

    def _fill_curriculum_with_gemini(self):
        from core.models import Curriculum, UserGoal, LearningStats, SolveHistory
        self.stdout.write("\n📚 Gemini AI로 커리큘럼 생성 중...")
        if Curriculum.objects.filter(user=self.student, is_active=True).exists():
            self.stdout.write("   이미 존재 — 건너뜀"); return
        goal = UserGoal.objects.filter(user=self.student, is_active=True).first()
        if not goal:
            self.stderr.write("   UserGoal 없음 — 건너뜀"); return

        solve_count = SolveHistory.objects.filter(user=self.student).count()
        tags  = list(LearningStats.objects.filter(user=self.student, stat_type="algo_tag").values_list("stat_key", flat=True))
        langs = list(LearningStats.objects.filter(user=self.student, stat_type="language").values_list("stat_key", flat=True))

        prompt = f"""당신은 취업 준비 학습 플랫폼 ELAW의 AI 커리큘럼 생성기입니다.
아래 사용자 정보를 바탕으로 8주 학습 커리큘럼을 JSON 형식으로 생성해주세요.

[사용자 정보]
- 이름: 오성환 / 목표 직무: {goal.job_role} / 관심 분야: {goal.field}
- 주요 언어: {', '.join(langs) if langs else 'Python'}
- 백준 풀이 수: {solve_count}문제
- 학습한 알고리즘 태그: {', '.join(tags) if tags else '수학, 구현, 기하학'}
- 학습 기간: {goal.duration_weeks}주

[요구사항]
- 총 8주 / 1~4주: 알고리즘 보완 / 5~8주: {goal.field} 기술 심화
- 각 주차마다 theme, tasks(3개), recommended_problems(백준 번호), estimated_hours 포함

[JSON만 출력, 설명 없이]
{{"total_weeks":8,"field":"{goal.field}","job_role":"{goal.job_role}","weeks":[{{"week":1,"theme":"","tasks":[],"recommended_problems":[],"estimated_hours":0}}]}}"""

        self.stdout.write("   Gemini API 호출 중... (10~20초 소요)")
        raw = self._call_gemini(prompt, "curriculum")

        content = None
        if raw:
            try:
                clean = raw.strip()
                if "```" in clean:
                    clean = clean.split("```")[1]
                    if clean.startswith("json"): clean = clean[4:]
                content = json.loads(clean.strip())
                self.stdout.write("   ✅ Gemini 커리큘럼 생성 성공!")
            except json.JSONDecodeError:
                self.stdout.write("   ⚠️  JSON 파싱 실패 → 기본 커리큘럼으로 대체")

        if not content:
            content = {
                "total_weeks": 8, "field": goal.field, "job_role": goal.job_role,
                "weeks": [
                    {"week":1,"theme":"자료구조 기초 (스택/큐/힙)","tasks":["스택 개념 학습","큐 구현 연습","백준 Silver 3문제"],"recommended_problems":["10828","10845","1927"],"estimated_hours":8},
                    {"week":2,"theme":"그래프 탐색 (BFS/DFS)","tasks":["BFS/DFS 개념","미로 탐색 문제","연결 요소 문제"],"recommended_problems":["1260","2178","11724"],"estimated_hours":10},
                    {"week":3,"theme":"동적 프로그래밍 (DP)","tasks":["DP 개념 정리","1D DP 문제","2D DP 문제"],"recommended_problems":["1463","9095","11053"],"estimated_hours":12},
                    {"week":4,"theme":"이분탐색 & 그리디","tasks":["이분탐색 구현","그리디 전략","백준 Silver 문제"],"recommended_problems":["1920","2805","11047"],"estimated_hours":10},
                    {"week":5,"theme":"Django 백엔드 기초","tasks":["Django ORM 심화","REST API 설계","JWT 인증"],"recommended_problems":[],"estimated_hours":14},
                    {"week":6,"theme":"Django REST Framework 심화","tasks":["Serializer 설계","ViewSet 구현","API 문서화"],"recommended_problems":[],"estimated_hours":14},
                    {"week":7,"theme":"React 프론트엔드 연동","tasks":["React 컴포넌트","Axios API 연동","상태 관리"],"recommended_problems":[],"estimated_hours":14},
                    {"week":8,"theme":"포트폴리오 & 취업 준비","tasks":["GitHub 정리","포트폴리오 완성","자기소개서 작성"],"recommended_problems":[],"estimated_hours":10},
                ],
            }

        Curriculum.objects.create(user=self.student, goal=goal, is_active=True, version=1, content_json=content)
        self.stdout.write(f"   → {content['total_weeks']}주 커리큘럼 저장 완료")

    def _fill_matches(self):
        from core.models import Match, LearningStats
        self.stdout.write("\n🤝 매칭 점수 계산 중...")
        my_skills = {"python","django","sql","git","rest api","mysql"}
        algo_tags = set(LearningStats.objects.filter(user=self.student, stat_type="algo_tag").values_list("stat_key", flat=True))
        count = 0
        for posting in self.posting_objs:
            req  = [s.lower() for s in (posting.required_skills  or [])]
            pref = [s.lower() for s in (posting.preferred_skills or [])]
            req_score  = (sum(1 for s in req  if s in my_skills) / len(req)  * 60) if req  else 0
            pref_score = (sum(1 for s in pref if s in my_skills) / len(pref) * 25) if pref else 0
            algo_bonus = min(len(algo_tags) * 1.5, 15)
            total = round(min(req_score + pref_score + algo_bonus, 100), 1)
            if total >= 80:   status = "applied"
            elif total >= 65: status = "scrapped"
            elif total >= 50: status = "viewed"
            else:             status = "recommended"
            _, created = Match.objects.get_or_create(
                user=self.student, posting=posting,
                defaults=dict(match_score=total, status=status),
            )
            if created:
                count += 1
                self.stdout.write(f"   {posting.title[:38]}... → {total}점 ({status})")
        self.stdout.write(f"   → {count}개 매칭 완료")

    def _fill_posts(self):
        from core.models import Post
        self.stdout.write("\n📢 게시글 생성 중...")
        posts_data = [
            ("notice","ELAW 플랫폼 정식 오픈 안내",
             "안녕하세요, ELAW 운영팀입니다.\n\n취업 연계 학습 플랫폼 ELAW가 정식 오픈되었습니다.\n\n"
             "✅ 주요 기능\n- 백준(solved.ac) 연동 → 알고리즘 학습 통계 자동 분석\n"
             "- GitHub 연동 → 프로젝트 포트폴리오 자동 생성\n"
             "- Gemini AI → 목표 직무 맞춤 커리큘럼 생성\n- 취업 매칭 → AI 기반 공고 추천\n\n많은 이용 부탁드립니다!", True),
            ("contest","2026 상반기 주요 IT 기업 코딩테스트 일정 안내",
             "2026 상반기 주요 IT 기업 코딩테스트 일정을 안내드립니다.\n\n"
             "📅 예정 일정 (변동 가능)\n- 카카오: 2026년 4월 중순\n- 네이버: 2026년 4월 하순\n- 라인플러스: 2026년 5월 초\n\n"
             "ELAW에서 취약 알고리즘 태그를 분석하고 집중 학습해보세요!", False),
            ("notice","시스템 정기 점검 안내 (3/30 새벽 2시~4시)",
             "안녕하세요, ELAW 운영팀입니다.\n\n⏰ 점검 일시: 2026년 3월 30일(일) 새벽 2:00~4:00\n"
             "🔧 점검 내용: DB 최적화, 보안 패치 적용\n\n점검 시간 동안 서비스 이용이 제한됩니다.", True),
            ("event","[이벤트] 3월 신규 가입 시 AI 커리큘럼 무료 제공",
             "🎉 ELAW 오픈 기념 신규 가입 이벤트!\n\n3월 한 달간 신규 가입하시는 모든 분께 "
             "Gemini AI 맞춤 커리큘럼 생성권을 무료로 제공해드립니다.\n\n"
             "📌 기간: 2026년 3월 1일~31일 / 📌 혜택: AI 커리큘럼 1회 무료 생성", False),
            ("contest","목포대학교 2026 캡스톤디자인 경진대회 안내",
             "목포대학교 2026 캡스톤디자인 경진대회 일정을 안내드립니다.\n\n"
             "📅 접수: 2026년 4월 1일~15일 / 발표: 2026년 5월 중순\n\n"
             "ELAW 플랫폼을 캡스톤 프로젝트로 출품할 예정입니다. 💪", False),
        ]
        count = 0
        for category, title, content, pinned in posts_data:
            _, created = Post.objects.get_or_create(
                title=title,
                defaults=dict(author=self.admin, category=category, content=content,
                              is_pinned=pinned, view_count=random.randint(30,300)),
            )
            if created:
                count += 1
                self.stdout.write(f"   [{category}] {title[:40]}")
        self.stdout.write(f"   → {count}개 게시글 생성 완료")

    def _print_summary(self):
        from core.models import (User, Company, PlatformLink, UserGoal, Curriculum,
                                  SolveHistory, LearningStats, Portfolio, JobPosting, Match, Post, AiLog)
        self.stdout.write("\n" + "─"*45)
        self.stdout.write("📊 최종 DB 현황 (12개 테이블)")
        self.stdout.write("─"*45)
        for name, model in [
            ("User",User),("Company",Company),("PlatformLink",PlatformLink),
            ("UserGoal",UserGoal),("Curriculum",Curriculum),("SolveHistory",SolveHistory),
            ("LearningStats",LearningStats),("Portfolio",Portfolio),("JobPosting",JobPosting),
            ("Match",Match),("Post",Post),("AiLog",AiLog),
        ]:
            cnt = model.objects.count()
            self.stdout.write(f"  {'✅' if cnt>0 else '❌'} {name:<15} {'█'*min(cnt,25)} {cnt}")
        self.stdout.write("─"*45)
