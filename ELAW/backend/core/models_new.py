"""
core/models_new.py

신규 테이블 3개 레이어:
  1. 문제 추천 레이어  - problem_recommendations, skill_gaps
  2. 포트폴리오 레이어 - portfolio_snapshots, portfolio_feedback
"""

from django.db import models


# ══════════════════════════════════════════════
# 레이어 1: 문제 추천
# ══════════════════════════════════════════════

class ProblemRecommendation(models.Model):

    class Platform(models.TextChoices):
        BAEKJOON    = 'baekjoon',    '백준'
        PROGRAMMERS = 'programmers', '프로그래머스'
        LEETCODE    = 'leetcode',    'LeetCode'

    class Status(models.TextChoices):
        PENDING  = 'pending',  '미도전'
        SOLVED   = 'solved',   '풀이 완료'
        SKIPPED  = 'skipped',  '건너뜀'

    user        = models.ForeignKey(
        'core.User', on_delete=models.CASCADE,
        related_name='problem_recommendations'
    )
    posting     = models.ForeignKey(
        'core.JobPosting', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='problem_recommendations',
        help_text='어떤 채용공고를 목표로 추천됐는지'
    )
    skill_gap   = models.ForeignKey(
        'core.SkillGap', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='recommendations',
        help_text='어떤 스킬 갭을 채우기 위한 추천인지'
    )

    problem_id    = models.CharField(max_length=100, help_text='플랫폼 내 문제 ID')
    platform      = models.CharField(max_length=20, choices=Platform.choices)
    title         = models.CharField(max_length=300, null=True, blank=True)
    algo_tags     = models.JSONField(null=True, blank=True)
    difficulty    = models.CharField(max_length=30, null=True, blank=True)

    relevance_score = models.FloatField(help_text='추천 관련성 점수 (0~1)')
    reason          = models.TextField(null=True, blank=True)
    model_version   = models.CharField(max_length=50, default='v1.0')

    status          = models.CharField(max_length=10, choices=Status.choices,
                                       default=Status.PENDING)
    recommended_at  = models.DateTimeField(auto_now_add=True)
    solved_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table        = 'problem_recommendations'
        unique_together = [['user', 'platform', 'problem_id', 'posting']]
        indexes         = [
            models.Index(fields=['user', 'status'],      name='idx_pr_user_status'),
            models.Index(fields=['user', 'posting'],     name='idx_pr_user_posting'),
            models.Index(fields=['-relevance_score'],    name='idx_pr_relevance'),
            models.Index(fields=['recommended_at'],      name='idx_pr_recommended_at'),
        ]

    def __str__(self):
        return (f"[{self.platform}#{self.problem_id}] "
                f"{self.user.name} ({self.relevance_score:.2f})")


class SkillGap(models.Model):

    user    = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='skill_gaps'
    )
    posting = models.ForeignKey(
        'core.JobPosting', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='skill_gaps'
    )

    skill_name      = models.CharField(max_length=100)
    skill_category  = models.CharField(max_length=30, null=True, blank=True)

    current_level   = models.FloatField()
    required_level  = models.FloatField()
    gap_score       = models.FloatField()

    recommended_problem_ids = models.JSONField(null=True, blank=True)

    calculation_method = models.CharField(max_length=50, default='rule_based')
    calculated_at   = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'skill_gaps'
        unique_together = [['user', 'posting', 'skill_name']]
        indexes         = [
            models.Index(fields=['user', 'posting'],   name='idx_sg_user_posting'),
            models.Index(fields=['-gap_score'],        name='idx_sg_gap_score'),
            models.Index(fields=['skill_category'],    name='idx_sg_category'),
        ]

    def __str__(self):
        return (f"{self.user.name} | {self.skill_name} "
                f"현재:{self.current_level:.0f} 갭:{self.gap_score:+.0f}")


# ══════════════════════════════════════════════
# 레이어 2: 포트폴리오 생성 & RLHF 피드백
# ══════════════════════════════════════════════

class PortfolioSnapshot(models.Model):

    class Method(models.TextChoices):
        GEMINI   = 'gemini',   'Gemini API'
        MODEL_V1 = 'model_v1', '자체 모델 v1'
        MODEL_V2 = 'model_v2', '자체 모델 v2 (RLHF)'
        MANUAL   = 'manual',   '수동 편집'

    portfolio = models.ForeignKey(
        'core.Portfolio', on_delete=models.CASCADE,
        related_name='snapshots'
    )
    user      = models.ForeignKey(
        'core.User', on_delete=models.CASCADE,
        related_name='portfolio_snapshots'
    )
    posting   = models.ForeignKey(
        'core.JobPosting', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='portfolio_snapshots'
    )

    structured_resume = models.JSONField(null=True, blank=True)
    skill_analysis    = models.JSONField(null=True, blank=True)
    problem_history   = models.JSONField(null=True, blank=True)

    generated_content = models.JSONField(null=True, blank=True)
    generation_method = models.CharField(
        max_length=20, choices=Method.choices, default=Method.GEMINI
    )
    generation_prompt = models.TextField(null=True, blank=True)
    model_version     = models.CharField(max_length=50, null=True, blank=True)

    version    = models.PositiveSmallIntegerField(default=1)
    is_final   = models.BooleanField(default=False)
    quality_score = models.FloatField(null=True, blank=True)

    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'portfolio_snapshots'
        indexes  = [
            models.Index(fields=['user', 'is_final'],     name='idx_ps_user_final'),
            models.Index(fields=['portfolio', 'version'], name='idx_ps_version'),
            models.Index(fields=['generation_method'],    name='idx_ps_method'),
            models.Index(fields=['generated_at'],         name='idx_ps_generated_at'),
        ]

    def __str__(self):
        return f"{self.user.name} 포트폴리오 v{self.version} [{self.generation_method}]"


class PortfolioFeedback(models.Model):

    class Rating(models.IntegerChoices):
        VERY_BAD  = 1, '매우 불만족'
        BAD       = 2, '불만족'
        NEUTRAL   = 3, '보통'
        GOOD      = 4, '만족'
        VERY_GOOD = 5, '매우 만족'

    snapshot  = models.ForeignKey(
        PortfolioSnapshot, on_delete=models.CASCADE,
        related_name='feedbacks'
    )
    user      = models.ForeignKey(
        'core.User', on_delete=models.CASCADE,
        related_name='portfolio_feedbacks'
    )

    rating         = models.IntegerField(choices=Rating.choices)
    feedback_text  = models.TextField(null=True, blank=True)
    edited_content = models.JSONField(null=True, blank=True)
    rlhf_labels    = models.JSONField(null=True, blank=True)

    used_for_training = models.BooleanField(default=False)
    training_batch_id = models.CharField(max_length=100, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'portfolio_feedback'
        unique_together = [['snapshot', 'user']]
        indexes         = [
            models.Index(fields=['used_for_training'], name='idx_pf_training'),
            models.Index(fields=['rating'],            name='idx_pf_rating'),
            models.Index(fields=['created_at'],        name='idx_pf_created_at'),
        ]

    def __str__(self):
        return f"{self.user.name} -> 스냅샷#{self.snapshot.id} 평점:{self.rating}"
