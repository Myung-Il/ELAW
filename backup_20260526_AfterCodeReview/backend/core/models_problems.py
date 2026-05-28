"""
core/models_problems.py

문제 데이터셋 & 연관도 데이터셋 저장 모델

[JobProblems.zip]  → JobProblem (6,000개 문제)
[LearningPaths.zip] → JobProblemCluster, ProblemEdge, LearningPathMeta

기존 테이블과의 연계:
  JobProblem      ← problem_recommendations.problem_id (백준 외 자체 문제)
  JobProblem      ← solve_history (사용자 풀이 이력)
  JobProblemCluster ← skill_gaps (클러스터 기반 추천)
  ProblemEdge     → 선수과목 관계로 학습 순서 결정
"""

from django.db import models


# ══════════════════════════════════════════════
# 1. 문제 데이터셋 (JobProblems.zip)
# ══════════════════════════════════════════════

class JobProblem(models.Model):
    """
    직군별 문제 1개.
    30개 직군 × 200문제 = 총 6,000개.

    difficulty 분포:
      university_level :  25개 (기초)
      junior_level     :  25개 (신입)
      middle_level     :  50개 (중간)
      senior_level     : 100개 (고급)
    """

    class Difficulty(models.TextChoices):
        UNIVERSITY = 'university_level', '대학 기초'
        JUNIOR     = 'junior_level',     '신입 수준'
        MIDDLE     = 'middle_level',     '중간 경력'
        SENIOR     = 'senior_level',     '시니어 수준'

    class QuestionType(models.TextChoices):
        DEFINITION   = 'definition',   '개념 정의'
        APPLICATION  = 'application',  '응용'
        DEBUGGING    = 'debugging',    '디버깅'
        DESIGN       = 'design',       '설계'
        ANALYSIS     = 'analysis',     '분석'
        CODING       = 'coding',       '코딩'

    # 원본 식별자
    # question_id는 각 직군 파일 내에서만 고유 (1~200)
    # 전체 고유 키: (job_role, question_id)
    original_question_id = models.PositiveIntegerField(
        help_text='파일 내 question_id (1~200)'
    )
    job_role = models.CharField(
        max_length=100,
        help_text='예) AI Engineer, Backend Engineer'
    )

    # 분류
    difficulty    = models.CharField(max_length=20, choices=Difficulty.choices)
    question_type = models.CharField(max_length=20, choices=QuestionType.choices,
                                     null=True, blank=True)
    category      = models.CharField(max_length=100,
                                     help_text='예) Machine Learning, Deep Learning')
    subcategory   = models.CharField(max_length=100, null=True, blank=True,
                                     help_text='예) Evaluation, Optimization')

    # 문제 내용
    skills_required = models.JSONField(
        help_text='예) ["Metrics", "ROC AUC"]'
    )
    scenario  = models.TextField(null=True, blank=True,
                                 help_text='문제 상황 설명')
    question  = models.TextField(help_text='문제 본문')
    choices   = models.JSONField(
        help_text='객관식 선택지 배열 예) ["SGD","Dropout","BN","ReLU"]'
    )
    correct_answer = models.CharField(max_length=300,
                                      help_text='정답 문자열')
    explanation    = models.TextField(null=True, blank=True,
                                      help_text='해설')

    # 통계 (사용자 풀이 집계 후 갱신)
    total_attempts = models.PositiveIntegerField(default=0)
    correct_count  = models.PositiveIntegerField(default=0)
    avg_correct_rate = models.FloatField(null=True, blank=True,
                                         help_text='전체 사용자 평균 정답률')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'job_problems'
        unique_together = [['job_role', 'original_question_id']]
        indexes = [
            models.Index(fields=['job_role'],              name='idx_jp_job_role'),
            models.Index(fields=['difficulty'],            name='idx_jp_difficulty'),
            models.Index(fields=['category', 'subcategory'], name='idx_jp_category'),
            models.Index(fields=['question_type'],         name='idx_jp_qtype'),
        ]

    def __str__(self):
        return (f"[{self.job_role}] Q{self.original_question_id} "
                f"({self.difficulty}) {self.question[:50]}")


# ══════════════════════════════════════════════
# 2. 클러스터 (LearningPaths.zip - clusters)
# ══════════════════════════════════════════════

class JobProblemCluster(models.Model):
    """
    같은 category/subcategory로 묶인 문제 클러스터.
    cluster_id 예) "Deep Learning__Optimization"

    사용 용도:
      - 스킬 갭이 있는 category/subcategory를 파악
      - 해당 클러스터 문제를 우선 추천
      - 클러스터 완료율로 능력 수치화
    """

    job_role    = models.CharField(max_length=100)
    cluster_id  = models.CharField(
        max_length=200,
        help_text='예) Deep Learning__Optimization'
    )
    category    = models.CharField(max_length=100)
    subcategory = models.CharField(max_length=100, null=True, blank=True)
    size        = models.PositiveSmallIntegerField(help_text='클러스터 내 문제 수')

    # 클러스터에 속한 문제 ID 배열
    question_ids  = models.JSONField(
        help_text='original_question_id 배열 예) [2, 20, 27]'
    )
    # 공통 스킬
    common_skills = models.JSONField(
        null=True, blank=True,
        help_text='클러스터 내 공통 스킬 예) ["Optimizer","Adam"]'
    )

    # 메타 파라미터 (LearningPath 생성 시 사용된 가중치)
    skill_weight          = models.FloatField(default=0.6)
    scenario_weight       = models.FloatField(default=0.4)
    min_combined_score    = models.FloatField(default=0.15)
    same_category_bonus   = models.FloatField(default=0.1)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'job_problem_clusters'
        unique_together = [['job_role', 'cluster_id']]
        indexes = [
            models.Index(fields=['job_role'],   name='idx_jpc_job_role'),
            models.Index(fields=['category'],   name='idx_jpc_category'),
        ]

    def __str__(self):
        return f"[{self.job_role}] {self.cluster_id} ({self.size}문제)"


# ══════════════════════════════════════════════
# 3. 문제 간 선수과목 관계 (LearningPaths.zip - edges)
# ══════════════════════════════════════════════

class ProblemEdge(models.Model):
    """
    문제 A → 문제 B: A를 먼저 풀어야 B를 잘 풀 수 있다.

    is_prerequisite=True  → 선수과목 관계
    combined_score        → 연관도 점수 (높을수록 연관 강함)

    사용 용도:
      - 추천 순서 결정: 갭이 있는 문제의 선수 문제부터 추천
      - 학습 경로(Learning Path) 시각화
      - 포트폴리오에서 학습 진행도 표현
    """

    job_role = models.CharField(max_length=100)

    # source → target 관계
    source_problem = models.ForeignKey(
        JobProblem, on_delete=models.CASCADE,
        related_name='outgoing_edges',
        help_text='선수 문제 (먼저 풀어야 하는 문제)'
    )
    target_problem = models.ForeignKey(
        JobProblem, on_delete=models.CASCADE,
        related_name='incoming_edges',
        help_text='후속 문제 (나중에 풀 문제)'
    )

    # 연관도 점수
    combined_score       = models.FloatField(
        help_text='스킬+시나리오 가중 합산 점수'
    )
    skill_overlap        = models.FloatField(
        null=True, blank=True,
        help_text='스킬 겹침 정도 (0~1)'
    )
    scenario_similarity  = models.FloatField(
        null=True, blank=True,
        help_text='시나리오 유사도 (0~1)'
    )
    is_prerequisite      = models.BooleanField(
        default=False,
        help_text='True면 source를 먼저 풀어야 target 이해 가능'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'problem_edges'
        unique_together = [['source_problem', 'target_problem']]
        indexes = [
            models.Index(fields=['job_role'],          name='idx_pe_job_role'),
            models.Index(fields=['is_prerequisite'],   name='idx_pe_prereq'),
            models.Index(fields=['-combined_score'],   name='idx_pe_score'),
            models.Index(fields=['target_problem'],    name='idx_pe_target'),
        ]

    def __str__(self):
        rel = '→(선수)' if self.is_prerequisite else '→(연관)'
        return (f"[{self.job_role}] "
                f"Q{self.source_problem.original_question_id} "
                f"{rel} "
                f"Q{self.target_problem.original_question_id} "
                f"({self.combined_score:.2f})")


# ══════════════════════════════════════════════
# 4. 학습 경로 메타 (LearningPaths.zip - metadata)
# ══════════════════════════════════════════════

class LearningPathMeta(models.Model):
    """
    직군별 LearningPath 생성 메타 정보.
    파일 단위로 1개씩 저장 (30개 직군 → 30행).
    """

    job_role           = models.CharField(max_length=100, unique=True)
    source_file        = models.CharField(max_length=200,
                                          help_text='원본 파일명 예) AI_Engineer.json')
    total_problems     = models.PositiveSmallIntegerField()
    cluster_count      = models.PositiveSmallIntegerField()
    edge_count         = models.PositiveSmallIntegerField()
    isolated_problem_count = models.PositiveSmallIntegerField(
        help_text='어떤 클러스터에도 속하지 않는 독립 문제 수'
    )

    # 난이도 분포 (JSON)
    difficulty_distribution = models.JSONField(
        help_text='{"university_level":25,"junior_level":25,"middle_level":50,"senior_level":100}'
    )

    # 생성 파라미터
    skill_weight           = models.FloatField(default=0.6)
    scenario_weight        = models.FloatField(default=0.4)
    min_combined_score     = models.FloatField(default=0.15)
    max_prereqs_per_target = models.PositiveSmallIntegerField(default=3)
    same_category_bonus    = models.FloatField(default=0.1)

    loaded_at  = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'learning_path_meta'
        indexes  = [
            models.Index(fields=['job_role'], name='idx_lpm_job_role'),
        ]

    def __str__(self):
        return (f"[{self.job_role}] "
                f"문제:{self.total_problems} 클러스터:{self.cluster_count} "
                f"엣지:{self.edge_count}")


# ══════════════════════════════════════════════
# 5. 사용자 문제 풀이 이력 (자체 문제 전용)
#    - 기존 SolveHistory는 백준/프로그래머스 외부 플랫폼용
#    - JobProblemSolveHistory는 자체 JobProblem 풀이용
# ══════════════════════════════════════════════

class JobProblemSolveHistory(models.Model):
    """
    사용자가 자체 JobProblem을 푼 기록.

    흐름:
      사용자가 문제 풀기
      → JobProblemSolveHistory 저장
      → JobProblem.total_attempts, correct_count 갱신
      → LearningStats 재집계 (알고리즘 태그 → 스킬 정답률)
      → SkillGap 재계산
      → ProblemRecommendation 업데이트
      → PortfolioSnapshot 능력 수치 갱신
    """

    class Status(models.TextChoices):
        CORRECT   = 'correct',   '정답'
        INCORRECT = 'incorrect', '오답'
        SKIPPED   = 'skipped',   '건너뜀'

    user    = models.ForeignKey(
        'core.User', on_delete=models.CASCADE,
        related_name='job_problem_histories'
    )
    problem = models.ForeignKey(
        JobProblem, on_delete=models.CASCADE,
        related_name='solve_histories'
    )

    status         = models.CharField(max_length=10, choices=Status.choices)
    selected_answer = models.CharField(
        max_length=300, null=True, blank=True,
        help_text='사용자가 선택한 답'
    )
    time_spent_sec = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='풀이 소요 시간 (초)'
    )
    from_recommendation = models.ForeignKey(
        'core.ProblemRecommendation',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='solve_results',
        help_text='어떤 추천을 통해 풀었는지'
    )

    solved_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'job_problem_solve_history'
        indexes  = [
            models.Index(fields=['user', '-solved_at'],    name='idx_jpsh_user_time'),
            models.Index(fields=['user', 'status'],        name='idx_jpsh_user_status'),
            models.Index(fields=['problem'],               name='idx_jpsh_problem'),
        ]

    def __str__(self):
        return (f"{self.user.name} | "
                f"[{self.problem.job_role}] Q{self.problem.original_question_id} "
                f"→ {self.status}")

    def save(self, *args, **kwargs):
        """풀이 저장 시 문제 통계 자동 갱신
        
        주의: JobProblem.save()를 직접 호출하므로
              update_fields를 명시하여 무한 재귀 방지
        """
        super().save(*args, **kwargs)
        self._update_problem_stats()

    def _update_problem_stats(self):
        """JobProblem 통계 갱신 (별도 메서드로 분리 → 테스트 용이)"""
        from django.db.models import Count, Q
        problem = self.problem

        agg = JobProblemSolveHistory.objects.filter(
            problem=problem
        ).aggregate(
            total   = Count('id'),
            correct = Count('id', filter=Q(status=self.Status.CORRECT)),
        )
        total   = agg['total']   or 0
        correct = agg['correct'] or 0
        rate    = round(correct / total * 100, 2) if total > 0 else None

        # update() 사용 → save() 재호출 없이 DB 직접 갱신 (재귀 방지)
        JobProblem.objects.filter(pk=problem.pk).update(
            total_attempts   = total,
            correct_count    = correct,
            avg_correct_rate = rate,
        )