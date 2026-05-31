"""
python manage.py load_dataset

HuggingFace 데이터셋을 DB에 적재하는 관리 커맨드.

사용법:
  python manage.py load_dataset                  # 전체 2,640건 적재
  python manage.py load_dataset --limit 100      # 처음 100건만
  python manage.py load_dataset --parse          # 적재 후 Gemini로 구조화 파싱
  python manage.py load_dataset --company Google # 특정 기업만
  python manage.py load_dataset --level junior   # 특정 경력 레벨만

  # 데이터셋의 직무·회사명을 기업공고 화면(JobPosting)에 노출:
  python manage.py load_dataset --postings              # 적재 + 공고 변환
  python manage.py load_dataset --skip-load --postings  # 다운로드 없이 변환만
  python manage.py load_dataset --postings --reset-postings  # 기존 데이터셋 공고 갈아끼우기
"""

import uuid
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "HuggingFace 데이터셋을 DB에 적재"

    def add_arguments(self, parser):
        parser.add_argument('--limit',   type=int,  default=None, help='적재 건수 제한')
        parser.add_argument('--parse',   action='store_true',      help='Gemini로 구조화 파싱 실행')
        parser.add_argument('--company', type=str,  default=None,  help='특정 기업만 필터')
        parser.add_argument('--level',   type=str,  default=None,  help='경력 레벨 필터 (junior/mid/senior)')
        parser.add_argument('--reset',   action='store_true',      help='기존 데이터 삭제 후 재적재')
        parser.add_argument('--postings', action='store_true',
                            help='적재된 DatasetEntry를 기업공고(JobPosting)로 변환해 공고 화면에 노출')
        parser.add_argument('--reset-postings', action='store_true',
                            help='데이터셋 기반으로 생성됐던 기업/공고를 삭제 후 재생성')
        parser.add_argument('--skip-load', action='store_true',
                            help='HuggingFace 다운로드를 건너뛰고 기존 DatasetEntry로 변환만 수행')

    def handle(self, *args, **options):
        from core.models_dataset import DatasetEntry, DatasetLoadHistory

        # Windows 한국어 콘솔(cp949)에서 이모지 출력 시 UnicodeEncodeError 방지
        import sys
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(encoding='utf-8')
            except (AttributeError, ValueError):
                pass

        loaded = 0

        if options['skip_load']:
            self.stdout.write("⏭️  --skip-load: HuggingFace 다운로드 건너뜀 (기존 DatasetEntry 사용)")
            if options['parse']:
                self.stdout.write("\n🤖 Gemini로 구조화 파싱 시작...")
                self._run_parse(limit=50)
        else:
            # 기존 데이터 초기화
            if options['reset']:
                cnt = DatasetEntry.objects.count()
                DatasetEntry.objects.all().delete()
                self.stdout.write(f"기존 {cnt}건 삭제 완료")

            # 로드 이력 시작
            history = DatasetLoadHistory.objects.create(
                dataset_name='recuse/synthetic_resume_jd_raw_dataset',
                dataset_split='train',
                status='running',
            )

            try:
                self.stdout.write("📦 HuggingFace 데이터셋 로드 중...")
                from datasets import load_dataset
                ds = load_dataset("recuse/synthetic_resume_jd_raw_dataset")
                data = ds['train']
                history.total_rows = len(data)
                history.save(update_fields=['total_rows'])
                self.stdout.write(f"   총 {len(data)}건 확인")

                # 필터 적용
                rows = list(data)
                if options['company']:
                    rows = [r for r in rows if options['company'].lower() in r['curr_type_str'].lower()]
                    self.stdout.write(f"   기업 필터 '{options['company']}' 적용 → {len(rows)}건")
                if options['level']:
                    level = options['level'].lower()
                    rows = [r for r in rows if level in r['curr_type_str'].lower()]
                    self.stdout.write(f"   레벨 필터 '{options['level']}' 적용 → {len(rows)}건")
                if options['limit']:
                    rows = rows[:options['limit']]
                    self.stdout.write(f"   건수 제한 → {len(rows)}건")

                # DB 적재
                failed = 0
                self.stdout.write("💾 DB 적재 시작...")

                for i, row in enumerate(rows):
                    try:
                        curr_type_id  = row['curr_type_id']
                        curr_type_str = row['curr_type_str']
                        parsed = DatasetEntry.parse_curr_type_str(curr_type_str)

                        # 중복 방지
                        DatasetEntry.objects.update_or_create(
                            dataset_id=uuid.UUID(curr_type_id),
                            defaults={
                                'curr_type_str': curr_type_str,
                                'job_title':     parsed['job_title'],
                                'career_level':  parsed['career_level'],
                                'company_name':  parsed['company_name'],
                                'resume_raw':    row['resume'],
                                'jd_raw':        row['jd'],
                                'is_parsed':     False,
                            }
                        )
                        loaded += 1

                        if (i + 1) % 100 == 0:
                            self.stdout.write(f"   {i+1}/{len(rows)}건 처리 중...")

                    except Exception as e:
                        failed += 1
                        self.stderr.write(f"   오류 [{i}]: {e}")

                history.loaded_rows = loaded
                history.failed_rows = failed
                history.status      = 'success'
                history.finished_at = timezone.now()
                history.save()

                self.stdout.write(self.style.SUCCESS(
                    f"\n✅ 적재 완료: {loaded}건 성공, {failed}건 실패"
                ))

                # 통계 출력
                self._print_stats()

                # 파싱 실행 (선택)
                if options['parse']:
                    self.stdout.write("\n🤖 Gemini로 구조화 파싱 시작...")
                    self._run_parse(limit=min(loaded, 50))   # 비용 절감: 최대 50건

            except Exception as e:
                history.status        = 'failed'
                history.error_message = str(e)
                history.finished_at   = timezone.now()
                history.save()
                self.stderr.write(f"❌ 오류: {e}")
                raise

        # 기업공고(JobPosting) 변환 (선택)
        if options['postings']:
            self._create_postings(reset=options['reset_postings'])

    def _print_stats(self):
        """적재된 데이터 통계"""
        from core.models_dataset import DatasetEntry
        from django.db.models import Count

        self.stdout.write("\n📊 적재 데이터 통계:")
        self.stdout.write(f"   전체: {DatasetEntry.objects.count()}건")

        by_level = DatasetEntry.objects.values('career_level').annotate(n=Count('id'))
        for row in by_level:
            self.stdout.write(f"   경력({row['career_level']}): {row['n']}건")

        by_company = (DatasetEntry.objects
                      .values('company_name').annotate(n=Count('id'))
                      .order_by('-n')[:10])
        self.stdout.write("   기업 Top10:")
        for row in by_company:
            self.stdout.write(f"     {row['company_name']}: {row['n']}건")

    # ──────────────────────────────────────────
    # DatasetEntry(직무_경력_기업) → Company + JobPosting 변환
    # 기업공고 화면(/api/jobs/)이 읽는 JobPosting 테이블을 채워
    # 데이터셋의 실제 직무·회사명을 노출한다.
    # ──────────────────────────────────────────

    # 데이터셋 경력 → JobPosting.career_level enum (new/junior/senior/any)
    LEVEL_TO_POSTING = {'junior': 'junior', 'mid': 'senior', 'senior': 'senior', 'unknown': 'any'}
    # 데이터셋 경력 → 한글 표기 (공고 제목용)
    LEVEL_KO = {'junior': '주니어', 'mid': '미드레벨', 'senior': '시니어', 'unknown': '경력무관'}
    # 데이터셋 기반 기업 계정 식별용 이메일 도메인
    DATASET_EMAIL_DOMAIN = 'dataset.elaw.kr'

    # JD 본문에서 추출할 기술 키워드 (표시명, 정규식 — 대소문자 무시)
    _SKILL_PATTERNS = [
        ('Python', r'python'), ('JavaScript', r'java\s?script'),
        ('TypeScript', r'type\s?script'), ('Java', r'java(?!\s?script)'),
        ('Kotlin', r'kotlin'), ('Swift', r'swift'),
        ('Go', r'\bgolang\b|\bgo언어\b'), ('Rust', r'\brust\b'),
        ('C++', r'c\+\+'), ('C#', r'c#'), ('Ruby', r'\bruby\b'),
        ('PHP', r'\bphp\b'), ('Scala', r'\bscala\b'),
        ('React', r'\breact\b'), ('Vue.js', r'\bvue'), ('Angular', r'angular'),
        ('Next.js', r'next\.?js'), ('Node.js', r'node\.?js'),
        ('Django', r'django'), ('Flask', r'flask'), ('FastAPI', r'fast\s?api'),
        ('Spring', r'spring'), ('Express', r'express'),
        ('MySQL', r'mysql'), ('PostgreSQL', r'postgre'), ('MongoDB', r'mongo'),
        ('Redis', r'redis'), ('Oracle', r'oracle'), ('Kafka', r'kafka'),
        ('Elasticsearch', r'elasticsearch'),
        ('Docker', r'docker'), ('Kubernetes', r'kubernetes|k8s'),
        ('AWS', r'\baws\b'), ('GCP', r'\bgcp\b'), ('Azure', r'azure'),
        ('Terraform', r'terraform'), ('Jenkins', r'jenkins'),
        ('Git', r'\bgit\b'), ('Linux', r'linux'),
        ('TensorFlow', r'tensorflow'), ('PyTorch', r'pytorch'),
        ('Pandas', r'pandas'), ('NumPy', r'numpy'), ('Spark', r'spark'),
        ('Hadoop', r'hadoop'), ('Airflow', r'airflow'),
        ('GraphQL', r'graphql'), ('REST API', r'rest\s?api|restful'),
        ('SQL', r'\bsql\b'),
    ]

    def _extract_skills(self, text, cap=8):
        """JD 원문에서 등장하는 기술 키워드를 최대 cap개 추출"""
        import re
        if not text:
            return []
        found = []
        for name, pat in self._SKILL_PATTERNS:
            if re.search(pat, text, re.IGNORECASE):
                found.append(name)
            if len(found) >= cap:
                break
        return found

    def _create_postings(self, reset=False):
        import re
        from datetime import date, timedelta
        from django.utils import timezone
        from core.models import User, Company, JobPosting
        from core.models_dataset import DatasetEntry

        self.stdout.write("\n🏢 데이터셋 → 기업공고(JobPosting) 변환 시작...")

        # 이전에 데이터셋으로 만든 기업/공고 정리 (idempotent 재생성)
        if reset:
            old_users = User.objects.filter(
                email__endswith='@' + self.DATASET_EMAIL_DOMAIN
            )
            comp_cnt = Company.objects.filter(user__in=old_users).count()
            # Company on_delete=CASCADE → 소속 JobPosting 까지 함께 삭제
            old_users.delete()
            self.stdout.write(f"   기존 데이터셋 기업 {comp_cnt}개 + 공고 삭제 완료")

        entries = DatasetEntry.objects.all().only(
            'job_title', 'career_level', 'company_name', 'jd_raw'
        )
        if not entries.exists():
            self.stderr.write(
                "   ⚠️  DatasetEntry가 비어 있습니다. "
                "먼저 `python manage.py load_dataset` 으로 데이터를 적재하세요."
            )
            return

        # 1) 고유 기업 / 고유 공고(기업+직무+경력) 집계
        companies = {}                 # company_name → True
        postings  = {}                 # (company, job_title, level) → 대표 jd_raw
        for e in entries.iterator():
            cname = (e.company_name or 'Unknown').strip() or 'Unknown'
            jtitle = (e.job_title or 'Unknown').strip() or 'Unknown'
            companies[cname] = True
            key = (cname, jtitle, e.career_level)
            if key not in postings:
                postings[key] = e.jd_raw or ''

        self.stdout.write(
            f"   고유 기업 {len(companies)}개 / 고유 공고 {len(postings)}개 확인"
        )

        # 2) 기업(Company) + 백킹 User 생성
        company_objs = {}
        for cname in companies:
            slug = re.sub(r'[^a-z0-9]+', '-', cname.lower()).strip('-') or 'company'
            email = f"ds-{slug}@{self.DATASET_EMAIL_DOMAIN}"
            user, _ = User.objects.get_or_create(
                email=email,
                defaults=dict(name=f"{cname} 채용팀", role='company',
                              ai_consent=True, privacy_consent=True),
            )
            company, _ = Company.objects.get_or_create(
                user=user,
                defaults=dict(name=cname, industry='IT/소프트웨어',
                              description=f"{cname}의 채용 공고입니다.",
                              is_approved=True, approved_at=timezone.now()),
            )
            company_objs[cname] = company

        # 3) 채용공고(JobPosting) 생성
        created, skipped = 0, 0
        deadline = date.today() + timedelta(days=30)
        for (cname, jtitle, level), jd in postings.items():
            company = company_objs[cname]
            level_ko = self.LEVEL_KO.get(level, '')
            title = f"{jtitle} ({level_ko})" if level_ko else jtitle
            desc = (jd or '').strip()[:2000] or f"{cname} {jtitle} 포지션을 모집합니다."
            _, was_created = JobPosting.objects.get_or_create(
                company=company, title=title,
                defaults=dict(
                    description=desc,
                    required_skills=self._extract_skills(jd),
                    preferred_skills=[],
                    job_role=jtitle,
                    career_level=self.LEVEL_TO_POSTING.get(level, 'any'),
                    deadline=deadline,
                    is_active=True,
                ),
            )
            if was_created:
                created += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ 기업공고 변환 완료: 기업 {len(company_objs)}개, "
            f"공고 신규 {created}개 (이미 존재 {skipped}개)"
        ))
        self.stdout.write(f"   전체 JobPosting: {JobPosting.objects.count()}개")

    def _run_parse(self, limit=50):
        """Gemini AI로 이력서/JD 구조화 파싱"""
        import json, time, requests
        from django.conf import settings
        from core.models_dataset import DatasetEntry, DatasetResume, DatasetJobDescription

        key = getattr(settings, 'GEMINI_API_KEY', '')
        if not key:
            self.stderr.write("GEMINI_API_KEY 없음 — 파싱 생략")
            return

        entries = DatasetEntry.objects.filter(is_parsed=False)[:limit]
        parsed_count = 0

        for entry in entries:
            try:
                # 이력서 파싱
                resume_data = self._parse_with_gemini(
                    key,
                    f"""아래 이력서 텍스트에서 구조화 정보를 추출하여 JSON으로 반환하세요.

[이력서]
{entry.resume_raw[:2000]}

[출력 형식 - JSON만 반환]
{{
  "candidate_name": "이름",
  "email": "이메일",
  "phone": "전화번호",
  "linkedin_url": "URL 또는 null",
  "github_url": "URL 또는 null",
  "profile_summary": "요약 텍스트",
  "skills_json": {{"languages": [], "frameworks": [], "databases": [], "tools": []}},
  "experience_json": [{{"company": "", "role": "", "period": "", "duties": []}}],
  "education_json": [{{"school": "", "major": "", "degree": "", "period": ""}}],
  "certifications": [],
  "skill_tags": ["python", "django"]
}}"""
                )

                if resume_data:
                    DatasetResume.objects.update_or_create(
                        entry=entry,
                        defaults={
                            'candidate_name':  resume_data.get('candidate_name'),
                            'email':           resume_data.get('email'),
                            'phone':           resume_data.get('phone'),
                            'linkedin_url':    resume_data.get('linkedin_url'),
                            'github_url':      resume_data.get('github_url'),
                            'profile_summary': resume_data.get('profile_summary'),
                            'skills_json':     resume_data.get('skills_json'),
                            'experience_json': resume_data.get('experience_json'),
                            'education_json':  resume_data.get('education_json'),
                            'certifications':  resume_data.get('certifications'),
                            'skill_tags':      resume_data.get('skill_tags'),
                        }
                    )

                # JD 파싱
                jd_data = self._parse_with_gemini(
                    key,
                    f"""아래 채용공고 텍스트에서 구조화 정보를 추출하여 JSON으로 반환하세요.

[채용공고]
{entry.jd_raw[:2000]}

[출력 형식 - JSON만 반환]
{{
  "company_name": "기업명",
  "job_title": "직무명",
  "location": "위치",
  "employment_type": "정규직",
  "department": "부서",
  "responsibilities": ["주요업무1", "주요업무2"],
  "qualifications": {{"required": [], "preferred": []}},
  "benefits": [],
  "required_skill_tags": ["python", "java"],
  "preferred_skill_tags": ["docker", "kubernetes"]
}}"""
                )

                if jd_data:
                    DatasetJobDescription.objects.update_or_create(
                        entry=entry,
                        defaults={
                            'company_name':        jd_data.get('company_name', entry.company_name),
                            'job_title':           jd_data.get('job_title', entry.job_title),
                            'location':            jd_data.get('location'),
                            'employment_type':     jd_data.get('employment_type'),
                            'department':          jd_data.get('department'),
                            'responsibilities':    jd_data.get('responsibilities'),
                            'qualifications':      jd_data.get('qualifications'),
                            'benefits':            jd_data.get('benefits'),
                            'required_skill_tags': jd_data.get('required_skill_tags'),
                            'preferred_skill_tags': jd_data.get('preferred_skill_tags'),
                        }
                    )

                entry.is_parsed = True
                entry.save(update_fields=['is_parsed'])
                parsed_count += 1
                self.stdout.write(f"   파싱 완료: {entry}")
                time.sleep(1)   # rate limit 대응

            except Exception as e:
                self.stderr.write(f"   파싱 오류 [{entry.id}]: {e}")

        self.stdout.write(self.style.SUCCESS(f"\n✅ 파싱 완료: {parsed_count}건"))

    def _parse_with_gemini(self, key, prompt):
        """Gemini API 호출 + JSON 파싱"""
        import json, requests
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={key}"
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024},
        }
        try:
            resp = requests.post(url, json=body, timeout=20)
            resp.raise_for_status()
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            clean = raw.strip()
            if "```" in clean:
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            return json.loads(clean.strip())
        except Exception as e:
            self.stderr.write(f"   Gemini 파싱 오류: {e}")
            return None