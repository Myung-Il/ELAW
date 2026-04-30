"""
python manage.py load_dataset

HuggingFace 데이터셋을 DB에 적재하는 관리 커맨드.

사용법:
  python manage.py load_dataset                  # 전체 2,640건 적재
  python manage.py load_dataset --limit 100      # 처음 100건만
  python manage.py load_dataset --parse          # 적재 후 Gemini로 구조화 파싱
  python manage.py load_dataset --company Google # 특정 기업만
  python manage.py load_dataset --level junior   # 특정 경력 레벨만
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

    def handle(self, *args, **options):
        from core.models_dataset import DatasetEntry, DatasetLoadHistory

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
            loaded = 0
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