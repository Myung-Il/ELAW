"""
ELAW Platform — Django ORM Models
앱 이름  : core
작성자   : DB/AI 담당 (오)
Sprint   : 1~2

사용법:
  python manage.py makemigrations core
  python manage.py migrate
"""

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('이메일은 필수입니다.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

# ──────────────────────────────────────────────
# [1] 사용자 & 인증
# ──────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    """통합 사용자 계정 — 학생 / 기업 / 관리자"""
    objects = UserManager()

    class Role(models.TextChoices):
        STUDENT = 'student', '학생/구직자'
        COMPANY = 'company', '기업 담당자'
        ADMIN   = 'admin',   '플랫폼 관리자'

    email           = models.EmailField(max_length=255, unique=True)
    password_hash   = models.CharField(max_length=255, help_text='bcrypt 해시')
    name            = models.CharField(max_length=100)
    role            = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    phone           = models.CharField(max_length=20, null=True, blank=True)
    is_active       = models.BooleanField(default=True)
    ai_consent      = models.BooleanField(default=False, help_text='AI 이용 동의')
    privacy_consent = models.BooleanField(default=False, help_text='개인정보 수집 동의')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    class Meta:
        #db_table = 'users'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['role'],       name='idx_users_role'),
            models.Index(fields=['created_at'], name='idx_users_created_at'),
        ]

    def __str__(self):
        return f"{self.name} <{self.email}> [{self.role}]"


class Company(models.Model):
    """기업 회원 프로필 — users.role='company' 와 1:1"""

    user        = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company')
    name        = models.CharField(max_length=200)
    industry    = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    logo_url    = models.URLField(max_length=500, null=True, blank=True)
    website_url = models.URLField(max_length=500, null=True, blank=True)
    is_approved = models.BooleanField(default=False, help_text='관리자 승인 여부')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'companies'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['is_approved'], name='idx_companies_approved'),
        ]

    def __str__(self):
        return f"{self.name} ({'승인' if self.is_approved else '대기'})"


class PlatformLink(models.Model):
    """외부 플랫폼 연동 계정 (백준 / GitHub / 프로그래머스)"""

    class Platform(models.TextChoices):
        BAEKJOON    = 'baekjoon',    '백준'
        GITHUB      = 'github',      'GitHub'
        PROGRAMMERS = 'programmers', '프로그래머스'

    user          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='platform_links')
    platform      = models.CharField(max_length=20, choices=Platform.choices)
    external_id   = models.CharField(max_length=200, help_text='플랫폼 username / handle')
    access_token  = models.CharField(max_length=500, null=True, blank=True,
                                     help_text='OAuth 토큰 — AES-256 암호화 후 저장')
    token_expires = models.DateTimeField(null=True, blank=True)
    last_synced   = models.DateTimeField(null=True, blank=True)
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'platform_links'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        unique_together = [['user', 'platform']]
        indexes = [
            models.Index(fields=['last_synced'], name='idx_platform_links_synced'),
        ]

    def __str__(self):
        return f"{self.user.name} @ {self.platform} ({self.external_id})"


# ──────────────────────────────────────────────
# [2] 학습 & AI
# ──────────────────────────────────────────────

class UserGoal(models.Model):
    """목표 조사 결과 — 커리큘럼 생성의 입력 데이터"""

    class GoalType(models.TextChoices):
        STUDY = 'study', '공부'
        JOB   = 'job',   '취업'

    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='goals')
    goal_type      = models.CharField(max_length=10, choices=GoalType.choices)
    field          = models.CharField(max_length=100, null=True, blank=True,
                                      help_text='컴퓨터, 전기, 조선, 토목, 건축 등')
    job_role       = models.CharField(max_length=100, null=True, blank=True,
                                      help_text='백엔드, AI 개발자, 데이터 엔지니어 등')
    start_date     = models.DateField(null=True, blank=True)
    end_date       = models.DateField(null=True, blank=True)
    mid_eval_date  = models.DateField(null=True, blank=True, help_text='중간 평가일')
    duration_weeks = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active      = models.BooleanField(default=True, help_text='현재 활성 목표')
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'user_goals'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['user', 'is_active'], name='idx_user_goals_active'),
        ]

    def __str__(self):
        return f"{self.user.name} — {self.goal_type} / {self.field} / {self.job_role}"


class Curriculum(models.Model):
    """Gemini AI 생성 커리큘럼 — goal당 N개(버전 관리), 활성은 1개"""

    goal       = models.ForeignKey(UserGoal, on_delete=models.CASCADE, related_name='curricula')
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='curricula')
    # content_json 구조:
    # {
    #   "total_weeks": 8,
    #   "field": "컴퓨터",
    #   "job_role": "백엔드 개발자",
    #   "weeks": [
    #     {
    #       "week": 1,
    #       "theme": "Python 기초 & 배열·정렬",
    #       "tasks": ["리스트 조작 실습", "버블정렬 구현"],
    #       "recommended_problems": ["2750", "1181"],
    #       "estimated_hours": 8
    #     }, ...
    #   ]
    # }
    content_json = models.JSONField(help_text='Gemini 생성 주차별 학습 계획 전체')
    version      = models.PositiveSmallIntegerField(default=1, help_text='재생성 시 1씩 증가')
    is_active    = models.BooleanField(default=True, help_text='현재 사용 중인 커리큘럼')
    generated_at = models.DateTimeField(auto_now_add=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        #db_table = 'curricula'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['user', 'is_active'], name='idx_curricula_user_active'),
            models.Index(fields=['goal'],              name='idx_curricula_goal'),
        ]

    def __str__(self):
        return f"{self.user.name} 커리큘럼 v{self.version} ({'활성' if self.is_active else '비활성'})"


class SolveHistory(models.Model):
    """문제 풀이 이력 원본 — ETL 배치로 수집, 사용자 수동 입력도 허용"""

    class Platform(models.TextChoices):
        BAEKJOON    = 'baekjoon',    '백준'
        PROGRAMMERS = 'programmers', '프로그래머스'
        W3SCHOOLS   = 'w3schools',   'W3Schools'
        CUSTOM      = 'custom',      'ELAW 자체 문제'

    class Status(models.TextChoices):
        SOLVED  = 'solved',  '정답'
        FAILED  = 'failed',  '오답'
        PARTIAL = 'partial', '부분 정답'

    class Source(models.TextChoices):
        API    = 'api',    'API 자동 수집'
        CRAWL  = 'crawl',  '크롤링 수집'
        MANUAL = 'manual', '사용자 직접 입력'

    user          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='solve_history')
    platform      = models.CharField(max_length=20, choices=Platform.choices)
    problem_id    = models.CharField(max_length=50, help_text='플랫폼 내 문제 번호/코드')
    problem_title = models.CharField(max_length=300, null=True, blank=True)
    status        = models.CharField(max_length=10, choices=Status.choices)
    language      = models.CharField(max_length=50, null=True, blank=True,
                                     help_text='Python, Java, C++ 등')
    # algo_tags: ["정렬", "DP", "그래프"]
    algo_tags     = models.JSONField(null=True, blank=True, help_text='알고리즘 태그 배열')
    difficulty    = models.CharField(max_length=30, null=True, blank=True,
                                     help_text='Bronze5, Silver3, Level2 등')
    time_spent_min = models.SmallIntegerField(null=True, blank=True, help_text='풀이 소요 시간(분)')
    solved_at     = models.DateTimeField(help_text='실제 풀이 완료 시각')
    source        = models.CharField(max_length=10, choices=Source.choices, default=Source.API)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        #db_table = 'solve_history'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        unique_together = [['user', 'platform', 'problem_id']]
        indexes = [
            models.Index(fields=['user', '-solved_at'],  name='idx_solve_user_solved_at'),
            models.Index(fields=['platform'],            name='idx_solve_platform'),
            models.Index(fields=['language'],            name='idx_solve_language'),
        ]

    def __str__(self):
        return f"{self.user.name} | {self.platform} #{self.problem_id} [{self.status}]"


class LearningStats(models.Model):
    """언어·알고리즘 태그별 집계 통계 — 일 배치로 갱신"""

    class StatType(models.TextChoices):
        LANGUAGE = 'language',  '언어별'
        ALGO_TAG = 'algo_tag',  '알고리즘 태그별'

    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='learning_stats')
    stat_type      = models.CharField(max_length=15, choices=StatType.choices)
    stat_key       = models.CharField(max_length=100, help_text='"Python" 또는 "정렬"')
    total_count    = models.PositiveIntegerField(default=0, help_text='총 시도 수')
    solved_count   = models.PositiveIntegerField(default=0, help_text='정답 수')
    failed_count   = models.PositiveIntegerField(default=0, help_text='오답 수')
    correct_rate   = models.FloatField(null=True, blank=True,
                                       help_text='solved_count / total_count * 100')
    last_solved_at = models.DateTimeField(null=True, blank=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'learning_stats'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        unique_together = [['user', 'stat_type', 'stat_key']]
        indexes = [
            models.Index(fields=['user', 'correct_rate'], name='idx_stats_correct_rate'),
        ]

    def __str__(self):
        return (f"{self.user.name} | {self.stat_type}: {self.stat_key} "
                f"({self.solved_count}/{self.total_count}, {self.correct_rate:.1f}%)")


# ──────────────────────────────────────────────
# [3] 포트폴리오
# ──────────────────────────────────────────────

class Portfolio(models.Model):
    """AI 자동 생성 포트폴리오"""

    class Language(models.TextChoices):
        KO = 'ko', '한국어'
        EN = 'en', '영어'

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolios')
    title        = models.CharField(max_length=300, default='나의 개발자 포트폴리오')
    summary_text = models.TextField(null=True, blank=True, help_text='Gemini 생성 역량 요약')
    # content_json 구조:
    # {
    #   "sections": [
    #     { "type": "summary",  "title": "자기소개",  "content": "..." },
    #     { "type": "skills",   "title": "기술 스택", "items": ["Python","Django"] },
    #     { "type": "stats",    "title": "학습 통계", "solve_count": 312 },
    #     { "type": "projects", "title": "프로젝트",  "items": [{"name":"ELAW",...}] }
    #   ]
    # }
    content_json = models.JSONField(null=True, blank=True)
    public_slug  = models.SlugField(max_length=120, unique=True, null=True, blank=True,
                                    help_text='공개 URL: /portfolio/{slug}')
    pdf_path     = models.CharField(max_length=500, null=True, blank=True,
                                    help_text='서버 내 PDF 파일 경로')
    language     = models.CharField(max_length=5, choices=Language.choices, default=Language.KO)
    version      = models.PositiveSmallIntegerField(default=1)
    is_public    = models.BooleanField(default=True, help_text='공개 여부')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'portfolios'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['user'],             name='idx_portfolios_user_id'),
            models.Index(fields=['is_public', '-created_at'], name='idx_portfolios_public'),
        ]

    def __str__(self):
        return f"{self.user.name}의 포트폴리오 v{self.version}"


# ──────────────────────────────────────────────
# [4] 채용
# ──────────────────────────────────────────────

class JobPosting(models.Model):
    """기업 채용 공고"""

    class CareerLevel(models.TextChoices):
        NEW    = 'new',    '신입'
        JUNIOR = 'junior', '주니어 (1~3년)'
        SENIOR = 'senior', '시니어 (3년+)'
        ANY    = 'any',    '경력 무관'

    company          = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='job_postings')
    title            = models.CharField(max_length=300)
    description      = models.TextField(null=True, blank=True)
    # required_skills: ["Python", "Django", "MySQL"]
    required_skills  = models.JSONField(null=True, blank=True, help_text='필수 기술 스택 배열')
    preferred_skills = models.JSONField(null=True, blank=True, help_text='우대 기술 스택 배열')
    job_role         = models.CharField(max_length=100, null=True, blank=True)
    career_level     = models.CharField(max_length=10, choices=CareerLevel.choices, default=CareerLevel.ANY)
    deadline         = models.DateField(null=True, blank=True)
    is_active        = models.BooleanField(default=True)
    view_count       = models.PositiveIntegerField(default=0)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'job_postings'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['company', 'is_active'], name='idx_job_postings_company'),
            models.Index(fields=['job_role'],             name='idx_job_postings_role'),
            models.Index(fields=['deadline', 'is_active'],name='idx_job_postings_deadline'),
        ]

    def __str__(self):
        return f"[{self.company.name}] {self.title}"


class Match(models.Model):
    """AI 매칭 결과 및 지원 상태 추적"""

    class Status(models.TextChoices):
        RECOMMENDED = 'recommended', '시스템 추천'
        VIEWED      = 'viewed',      '열람'
        SCRAPPED    = 'scrapped',    '스크랩'
        APPLIED     = 'applied',     '지원 완료'
        REJECTED    = 'rejected',    '불합격'

    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches')
    posting     = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name='matches')
    match_score = models.FloatField(null=True, blank=True, help_text='AI 매칭 점수 (0~100)')
    status      = models.CharField(max_length=15, choices=Status.choices,
                                   default=Status.RECOMMENDED)
    applied_at  = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'matches'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        unique_together = [['user', 'posting']]
        indexes = [
            models.Index(fields=['user', '-match_score'],  name='idx_matches_user_score'),
            models.Index(fields=['posting', 'status'],     name='idx_matches_posting_status'),
        ]

    def __str__(self):
        return f"{self.user.name} → {self.posting.title} [{self.status}] score={self.match_score}"


# ──────────────────────────────────────────────
# [5] 커뮤니티 & 시스템
# ──────────────────────────────────────────────

class Post(models.Model):
    """게시판 — 관리자만 작성 (공지·대회·이벤트)"""

    class Category(models.TextChoices):
        NOTICE  = 'notice',  '공지사항'
        CONTEST = 'contest', '대회 정보'
        EVENT   = 'event',   '이벤트'

    author     = models.ForeignKey(User, on_delete=models.RESTRICT, related_name='posts',
                                   help_text='ON DELETE RESTRICT — 관리자 계정 보호')
    category   = models.CharField(max_length=10, choices=Category.choices)
    title      = models.CharField(max_length=300)
    content    = models.TextField()
    is_pinned  = models.BooleanField(default=False, help_text='상단 고정')
    view_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        #db_table = 'posts'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['category', '-created_at'], name='idx_posts_category_date'),
            models.Index(fields=['is_pinned', '-created_at'],name='idx_posts_pinned'),
        ]

    def __str__(self):
        return f"[{self.category}] {self.title}"


class AiLog(models.Model):
    """Gemini API 호출 이력 — 비용 추적 및 디버깅"""

    class Feature(models.TextChoices):
        CURRICULUM     = 'curriculum',     '커리큘럼 생성'
        WEAKNESS       = 'weakness',       '취약점 분석'
        RECOMMENDATION = 'recommendation', '문제 추천'
        PORTFOLIO      = 'portfolio',      '포트폴리오 생성'
        MATCHING       = 'matching',       '채용 매칭'
        PROBLEM_GEN    = 'problem_gen',    '문제 자동 생성'

    class Status(models.TextChoices):
        SUCCESS = 'success', '성공'
        ERROR   = 'error',   '에러'
        TIMEOUT = 'timeout', '타임아웃'
        CACHED  = 'cached',  '캐시 히트'

    user          = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='ai_logs',
                                      help_text='배치 작업은 NULL, 사용자 탈퇴 시 SET NULL')
    feature       = models.CharField(max_length=20, choices=Feature.choices)
    prompt_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    latency_ms    = models.PositiveIntegerField(null=True, blank=True, help_text='API 응답 지연(ms)')
    status        = models.CharField(max_length=10, choices=Status.choices, default=Status.SUCCESS)
    error_message = models.CharField(max_length=500, null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        #db_table = 'ai_logs'
        #managed    = False      # schema_v1.sql로 관리 — Django가 테이블 생성/삭제 안 함
        indexes = [
            models.Index(fields=['user', 'feature'], name='idx_ai_logs_user_feature'),
            models.Index(fields=['-created_at'],     name='idx_ai_logs_created_at'),
            models.Index(fields=['status'],          name='idx_ai_logs_status'),
        ]

    def __str__(self):
        user_str = self.user.name if self.user else 'SYSTEM'
        return f"[{self.feature}] {user_str} — {self.status} ({self.latency_ms}ms)"
