"""
core/models_dataset.py

HuggingFace 데이터셋 (recuse/synthetic_resume_jd_raw_dataset) 저장용 모델

데이터셋 구조:
  - curr_type_id  : UUID
  - curr_type_str : "직무_경력레벨_기업명"  예) Software Engineer_Junior_Google
  - resume        : 한국어 이력서 전문 텍스트
  - jd            : 한국어 채용공고 전문 텍스트

기존 DB와의 연결:
  - DatasetJobPosting → JobPosting (실제 공고와 연계 가능)
  - DatasetResume     → User, Portfolio (사용자 포트폴리오와 연계 가능)
  - DatasetMatchScore → Match (AI 학습 결과를 매칭에 활용)
"""

from django.db import models


# ──────────────────────────────────────────────
# 1. 데이터셋 원본 저장 테이블
#    HuggingFace에서 로드한 raw 데이터를 그대로 보존
# ──────────────────────────────────────────────

class DatasetEntry(models.Model):
    """
    데이터셋 원본 1행 = 1개의 (이력서, 채용공고) 쌍
    curr_type_str 파싱: Software Engineer_Junior_Google
                         → job_title / career_level / company_name
    """

    class CareerLevel(models.TextChoices):
        JUNIOR    = 'junior',    '신입/주니어'
        MID       = 'mid',       '중간경력 (3~5년)'
        SENIOR    = 'senior',    '시니어 (5년+)'
        UNKNOWN   = 'unknown',   '미분류'

    # 데이터셋 원본 필드
    dataset_id    = models.UUIDField(unique=True, help_text='curr_type_id (HuggingFace UUID)')
    curr_type_str = models.CharField(max_length=200, help_text='직무_경력레벨_기업 원본 문자열')

    # curr_type_str 파싱 결과
    job_title     = models.CharField(max_length=100, default='Software Engineer',
                                     help_text='직무명 예) Software Engineer')
    career_level  = models.CharField(max_length=10, choices=CareerLevel.choices,
                                     default=CareerLevel.UNKNOWN)
    company_name  = models.CharField(max_length=100, help_text='기업명 예) Google')

    # 원본 텍스트 전체 저장
    resume_raw    = models.TextField(help_text='이력서 원문 텍스트')
    jd_raw        = models.TextField(help_text='채용공고 원문 텍스트')

    # 처리 상태
    is_parsed     = models.BooleanField(default=False, help_text='구조화 파싱 완료 여부')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dataset_entries'
        indexes  = [
            models.Index(fields=['company_name'],  name='idx_ds_company'),
            models.Index(fields=['career_level'],  name='idx_ds_level'),
            models.Index(fields=['job_title'],     name='idx_ds_job'),
            models.Index(fields=['is_parsed'],     name='idx_ds_parsed'),
        ]

    def __str__(self):
        return f"[{self.career_level}] {self.job_title} @ {self.company_name}"

    @classmethod
    def parse_curr_type_str(cls, curr_type_str: str) -> dict:
        """
        'Software Engineer_Junior_Google'
        → {'job_title': 'Software Engineer', 'career_level': 'junior', 'company_name': 'Google'}
        """
        parts = curr_type_str.split('_')
        if len(parts) < 3:
            return {'job_title': curr_type_str, 'career_level': 'unknown', 'company_name': 'Unknown'}

        # 마지막이 회사, 가운데가 레벨, 앞이 직무 (언더스코어 포함 직무명 대응)
        company_name  = parts[-1].strip()
        raw_level     = parts[-2].strip().lower().replace('-', '').replace(' ', '')
        job_title     = '_'.join(parts[:-2]).strip()

        level_map = {
            'junior':   'junior',
            'midlevel': 'mid',
            'mid':      'mid',
            'senior':   'senior',
        }
        career_level = level_map.get(raw_level, 'unknown')

        return {
            'job_title':    job_title,
            'career_level': career_level,
            'company_name': company_name,
        }


# ──────────────────────────────────────────────
# 2. 이력서 구조화 테이블
#    원문 텍스트에서 Gemini AI로 파싱한 구조화 데이터
# ──────────────────────────────────────────────

class DatasetResume(models.Model):
    """
    DatasetEntry.resume_raw 를 파싱한 구조화 이력서.
    기존 Portfolio 모델과 연계 가능.
    """
    entry = models.OneToOneField(
        DatasetEntry, on_delete=models.CASCADE,
        related_name='parsed_resume'
    )

    # 기본 정보
    candidate_name  = models.CharField(max_length=100, null=True, blank=True)
    email           = models.CharField(max_length=200, null=True, blank=True)
    phone           = models.CharField(max_length=50,  null=True, blank=True)
    linkedin_url    = models.URLField(max_length=300,  null=True, blank=True)
    github_url      = models.URLField(max_length=300,  null=True, blank=True)

    # 요약
    profile_summary = models.TextField(null=True, blank=True, help_text='프로페셔널 요약')

    # 기술스택 (JSON 배열)
    # 예) {"languages": ["Python","Java"], "frameworks": ["Django","React"],
    #       "databases": ["MySQL"], "tools": ["Docker","Git"]}
    skills_json     = models.JSONField(null=True, blank=True, help_text='기술스택 구조화')

    # 경력 (JSON 배열)
    # 예) [{"company": "Google", "role": "Junior SE", "period": "2022.06~현재",
    #        "duties": ["API 개발", "코드리뷰"]}]
    experience_json = models.JSONField(null=True, blank=True, help_text='경력 구조화')

    # 학력 (JSON 배열)
    # 예) [{"school": "서울대", "major": "컴퓨터공학", "degree": "학사", "period": "2018~2022"}]
    education_json  = models.JSONField(null=True, blank=True, help_text='학력 구조화')

    # 프로젝트 (JSON 배열)
    projects_json   = models.JSONField(null=True, blank=True, help_text='프로젝트 구조화')

    # 자격증/수상
    certifications  = models.JSONField(null=True, blank=True, help_text='자격증 및 수상')

    # 추출된 핵심 스킬 태그 (매칭용)
    skill_tags      = models.JSONField(null=True, blank=True,
                                       help_text='정규화된 스킬 태그 배열 예) ["python","django","mysql"]')

    parsed_at       = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dataset_resumes'
        indexes  = [
            models.Index(fields=['candidate_name'], name='idx_dsresume_name'),
        ]

    def __str__(self):
        return f"Resume: {self.candidate_name or '(미파싱)'} - {self.entry}"


# ──────────────────────────────────────────────
# 3. 채용공고 구조화 테이블
#    원문 JD에서 파싱한 구조화 데이터
#    → 기존 JobPosting과 연계하거나 별도 학습용으로 활용
# ──────────────────────────────────────────────

class DatasetJobDescription(models.Model):
    """
    DatasetEntry.jd_raw 를 파싱한 구조화 채용공고.
    기존 JobPosting 모델과 연계 가능.
    """
    entry = models.OneToOneField(
        DatasetEntry, on_delete=models.CASCADE,
        related_name='parsed_jd'
    )

    # 기존 JobPosting과 연결 (선택적)
    job_posting = models.ForeignKey(
        'core.JobPosting', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='dataset_jds',
        help_text='기존 JobPosting과 연계 시 사용'
    )

    # 공고 기본 정보
    company_name    = models.CharField(max_length=100)
    job_title       = models.CharField(max_length=200)
    location        = models.CharField(max_length=200, null=True, blank=True)
    employment_type = models.CharField(max_length=50,  null=True, blank=True,
                                       help_text='정규직/계약직 등')
    department      = models.CharField(max_length=100, null=True, blank=True)

    # 직무 내용 (JSON 배열)
    responsibilities = models.JSONField(null=True, blank=True, help_text='주요 업무 리스트')

    # 자격 요건 (JSON)
    # {"required": [...], "preferred": [...]}
    qualifications   = models.JSONField(null=True, blank=True, help_text='자격 요건 구조화')

    # 혜택
    benefits         = models.JSONField(null=True, blank=True, help_text='복리후생 리스트')

    # 추출된 핵심 스킬 요구사항 (매칭용)
    required_skill_tags  = models.JSONField(null=True, blank=True,
                                            help_text='필수 스킬 태그 예) ["python","django"]')
    preferred_skill_tags = models.JSONField(null=True, blank=True,
                                            help_text='우대 스킬 태그')

    parsed_at  = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dataset_job_descriptions'
        indexes  = [
            models.Index(fields=['company_name'], name='idx_dsjd_company'),
            models.Index(fields=['job_title'],    name='idx_dsjd_title'),
        ]

    def __str__(self):
        return f"JD: {self.job_title} @ {self.company_name}"


# ──────────────────────────────────────────────
# 4. 이력서-공고 매칭 점수 테이블 (AI 학습용)
#    동일 DatasetEntry 내 resume ↔ jd 는 positive pair
#    다른 entry 간 조합은 negative pair
# ──────────────────────────────────────────────

class DatasetMatchScore(models.Model):
    """
    (이력서, 채용공고) 쌍에 대한 매칭 점수.

    사용 목적:
      1. AI 모델 학습 데이터 — positive/negative pair 레이블링
      2. 기존 Match 테이블의 점수 보정 참고 데이터
      3. 매칭 알고리즘 벤치마킹

    is_positive=True  → 같은 curr_type_str (데이터셋 내 정답 쌍)
    is_positive=False → 다른 curr_type_str (데이터셋 내 오답 쌍)
    """
    resume  = models.ForeignKey(
        DatasetResume, on_delete=models.CASCADE, related_name='match_scores'
    )
    jd      = models.ForeignKey(
        DatasetJobDescription, on_delete=models.CASCADE, related_name='match_scores'
    )

    # 레이블
    is_positive   = models.BooleanField(help_text='같은 entry의 resume-JD 쌍이면 True (정답)')

    # 규칙 기반 점수 (기존 match_engine.py 방식)
    rule_score    = models.FloatField(null=True, blank=True,
                                      help_text='스킬 키워드 매칭 기반 점수 (0~100)')

    # AI 모델 점수 (Gemini 또는 커스텀 모델)
    ai_score      = models.FloatField(null=True, blank=True,
                                      help_text='AI 모델 예측 점수 (0~100)')

    # 최종 사용 점수
    final_score   = models.FloatField(null=True, blank=True,
                                      help_text='rule_score + ai_score 가중 평균')

    # 점수 산출 근거 (설명 가능성)
    score_detail  = models.JSONField(null=True, blank=True,
                                     help_text='점수 세부 내역 예) {"skill_match": 60, "level_match": 20}')

    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'dataset_match_scores'
        unique_together = [['resume', 'jd']]
        indexes         = [
            models.Index(fields=['is_positive'],  name='idx_dsms_positive'),
            models.Index(fields=['final_score'],  name='idx_dsms_score'),
        ]

    def __str__(self):
        label = 'POS' if self.is_positive else 'NEG'
        return f"[{label}] {self.resume} ↔ {self.jd} score={self.final_score}"


# ──────────────────────────────────────────────
# 5. 데이터셋 로드 이력 테이블
#    언제 어떤 버전을 몇 건 로드했는지 추적
# ──────────────────────────────────────────────

class DatasetLoadHistory(models.Model):
    """데이터셋 배치 로드 이력 관리"""

    class Status(models.TextChoices):
        RUNNING  = 'running',  '실행 중'
        SUCCESS  = 'success',  '완료'
        FAILED   = 'failed',   '실패'

    dataset_name  = models.CharField(max_length=200,
                                     default='recuse/synthetic_resume_jd_raw_dataset')
    dataset_split = models.CharField(max_length=50, default='train')
    total_rows    = models.PositiveIntegerField(default=0, help_text='전체 행 수')
    loaded_rows   = models.PositiveIntegerField(default=0, help_text='성공적으로 적재된 행 수')
    failed_rows   = models.PositiveIntegerField(default=0, help_text='실패한 행 수')
    status        = models.CharField(max_length=10, choices=Status.choices,
                                     default=Status.RUNNING)
    error_message = models.TextField(null=True, blank=True)
    started_at    = models.DateTimeField(auto_now_add=True)
    finished_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dataset_load_history'
        indexes  = [
            models.Index(fields=['-started_at'], name='idx_dlh_started'),
        ]

    def __str__(self):
        return (f"[{self.status}] {self.dataset_name} "
                f"{self.loaded_rows}/{self.total_rows}건 "
                f"({self.started_at.strftime('%Y-%m-%d %H:%M')})")