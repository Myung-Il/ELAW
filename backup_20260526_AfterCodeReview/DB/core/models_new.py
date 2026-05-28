"""
core/models_new.py

신규 테이블 3개 레이어:
  1. 문제 추천 레이어  - problem_recommendations, skill_gaps
  2. 포트폴리오 레이어 - portfolio_snapshots, portfolio_feedback

프로젝트 목표:
  이력서 정형화 → 스킬 갭 분석 → 문제 추천 → 능력 향상 수치화
  → 시각적 포트폴리오 생성 → RLHF 피드백 → 모델 개선
"""

from django.db import models


# ══════════════════════════════════════════════
# 레이어 1: 문제 추천
# ══════════════════════════════════════════════

class ProblemRecommendation(models.Model):
    """
    문제 추천 모델이 사용자에게 추천한 문제 1건.

    흐름:
      사용자 풀이이력 + 채용공고 스킬 → 추천 모델
      → problem_recommendations 저장
      → 사용자가 풀면 solve_history 갱신
      → learning_stats 재집계
    """

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
        'SkillGap', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='recommendations',
        help_text='어떤 스킬 갭을 채우기 위한 추천인지'
    )

    # 문제 정보
    problem_id    = models.CharField(max_length=100, help_text='플랫폼 내 문제 ID')
    platform      = models.CharField(max_length=20, choices=Platform.choices)
    title         = models.CharField(max_length=300, null=True, blank=True)
    algo_tags     = models.JSONField(null=True, blank=True,
                                     help_text='예) ["DP", "그래프"]')
    difficulty    = models.CharField(max_length=30, null=True, blank=True,
                                     help_text='Bronze5, Silver3, Level2 등')

    # 추천 메타
    relevance_score = models.FloatField(help_text='추천 관련성 점수 (0~1)')
    reason          = models.TextField(null=True, blank=True,
                                       help_text='추천 이유 텍스트')
    model_version   = models.CharField(max_length=50, default='v1.0',
                                       help_text='추천 모델 버전')

    # 상태
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
                f"{self.user.name} → {self.posting.title if self.posting else '-'} "
                f"({self.relevance_score:.2f})")


class SkillGap(models.Model):
    """
    사용자의 현재 스킬 수준과 채용공고 요구 수준의 차이.

    흐름:
      solve_history + learning_stats → 현재 수준 계산
      채용공고 required_skills → 요구 수준
      gap = 요구 - 현재 → 갭이 클수록 우선 보완 필요
      → 해당 갭을 채울 문제를 problem_recommendations에 저장
    """

    user    = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='skill_gaps'
    )
    posting = models.ForeignKey(
        'core.JobPosting', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='skill_gaps'
    )

    # 스킬 정보
    skill_name      = models.CharField(max_length=100,
                                       help_text='예) Python, DP, 그래프')
    skill_category  = models.CharField(max_length=30, null=True, blank=True,
                                       help_text='language / algo_tag / framework')

    # 수준 (0~100)
    current_level   = models.FloatField(help_text='현재 역량 수준 (0~100)')
    required_level  = models.FloatField(help_text='공고 요구 수준 (0~100)')
    gap_score       = models.FloatField(help_text='required - current (음수면 충분)')

    # 갭을 채우기 위한 추천 문제 ID 목록
    recommended_problem_ids = models.JSONField(
        null=True, blank=True,
        help_text='이 갭을 채울 추천 문제 ID 리스트'
    )

    # 계산 메타
    calculation_method = models.CharField(
        max_length=50, default='rule_based',
        help_text='rule_based / model_based'
    )
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
                f"현재:{self.current_level:.0f} → 요구:{self.required_level:.0f} "
                f"갭:{self.gap_score:+.0f}")


# ══════════════════════════════════════════════
# 레이어 2: 포트폴리오 생성 & RLHF 피드백
# ══════════════════════════════════════════════

class PortfolioSnapshot(models.Model):
    """
    특정 시점의 포트폴리오 생성 결과물 1버전.

    generation_method:
      'gemini'    → Gemini API로 생성 (초기)
      'model_v1'  → 자체 포트폴리오 생성 모델 v1
      'model_v2'  → RLHF 피드백으로 개선된 v2

    is_final=True인 버전이 현재 사용자에게 보여지는 포트폴리오.

    흐름:
      structured_resume (데이터셋 파싱 결과 or 사용자 입력)
      + skill_analysis (SkillGap 분석 결과)
      + problem_history (SolveHistory 요약)
      → 포트폴리오 생성 (Gemini or 자체 모델)
      → portfolio_snapshots 저장
      → 사용자 피드백 → portfolio_feedback 저장
      → RLHF 학습 데이터 축적
    """

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
        null=True, blank=True, related_name='portfolio_snapshots',
        help_text='어떤 공고를 타겟으로 생성했는지'
    )

    # 입력 데이터 스냅샷 (생성 당시 사용한 데이터 보존)
    structured_resume = models.JSONField(
        null=True, blank=True,
        help_text='생성 당시 정형화된 이력서 데이터 (DatasetResume 또는 사용자 입력)'
    )
    skill_analysis    = models.JSONField(
        null=True, blank=True,
        help_text='SkillGap 분석 결과 요약'
    )
    problem_history   = models.JSONField(
        null=True, blank=True,
        help_text='SolveHistory 요약 - 풀이 수, 태그별 정답률, 향상 추이'
    )

    # 생성 결과
    generated_content = models.JSONField(
        null=True, blank=True,
        help_text='생성된 포트폴리오 섹션별 내용'
    )
    generation_method = models.CharField(
        max_length=20, choices=Method.choices, default=Method.GEMINI
    )
    generation_prompt = models.TextField(
        null=True, blank=True,
        help_text='생성에 사용된 프롬프트 (재현 및 개선용)'
    )
    model_version     = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='사용된 모델 버전'
    )

    # 버전 관리
    version    = models.PositiveSmallIntegerField(default=1)
    is_final   = models.BooleanField(default=False,
                                     help_text='현재 최종 버전 여부')

    # 품질 지표
    quality_score = models.FloatField(
        null=True, blank=True,
        help_text='자동 품질 평가 점수 (0~100)'
    )

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
        return (f"{self.user.name} 포트폴리오 v{self.version} "
                f"[{self.generation_method}] "
                f"{'★ 최종' if self.is_final else ''}")


class PortfolioFeedback(models.Model):
    """
    사용자가 포트폴리오 스냅샷에 남긴 피드백 → RLHF 학습 데이터.

    RLHF 피드백 루프:
      1. 사용자가 생성된 포트폴리오를 보고 평점/피드백 입력
      2. portfolio_feedback에 저장
      3. used_for_training=True인 데이터를 모아 모델 재학습
      4. 개선된 모델로 다음 포트폴리오 생성 → 더 나은 결과
      5. 반복

    rlhf_labels 구조 예시:
    {
      "overall": 4,          ← 전체 만족도 (1~5)
      "relevance": 3,        ← 공고 관련성
      "completeness": 5,     ← 정보 완성도
      "tone": 4,             ← 문체/어조
      "preferred_sections": ["skills", "projects"],
      "rejected_sections":  ["summary"],
      "edit_distance": 0.12  ← 사용자가 수정한 비율 (0=무수정, 1=전면수정)
    }
    """

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

    # 피드백 내용
    rating        = models.IntegerField(choices=Rating.choices)
    feedback_text = models.TextField(null=True, blank=True,
                                     help_text='자유 텍스트 피드백')
    edited_content = models.JSONField(
        null=True, blank=True,
        help_text='사용자가 직접 수정한 포트폴리오 내용 (원본과 비교용)'
    )

    # RLHF 레이블
    rlhf_labels = models.JSONField(
        null=True, blank=True,
        help_text='섹션별 선호/거부, 수정 비율 등 구조화된 RLHF 레이블'
    )

    # 학습 사용 여부
    used_for_training = models.BooleanField(
        default=False,
        help_text='모델 재학습에 사용됐으면 True'
    )
    training_batch_id = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='어느 학습 배치에 포함됐는지'
    )

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
        return (f"{self.user.name} → 스냅샷#{self.snapshot.id} "
                f"평점:{self.rating} "
                f"{'[학습사용]' if self.used_for_training else ''}")
    



from core.models_new import SkillGap, ProblemRecommendation, PortfolioSnapshot, PortfolioFeedback
from core.models_problems import JobProblem, JobProblemCluster, ProblemEdge, LearningPathMeta, JobProblemSolveHistory
from core.models_register import *