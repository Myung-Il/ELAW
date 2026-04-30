"""
core/models_register.py

core/models.py 맨 아래에 아래 한 줄을 추가하세요:
    from core.models_register import *

이 파일은 신규 모델들을 Django ORM에 등록합니다.
분리된 모델 파일들을 한 곳에서 관리하여
makemigrations, admin, shell 등에서 정상 인식되게 합니다.
"""

# ── 데이터셋 레이어 ───────────────────────────────────────────
from core.models_dataset import (       # noqa: F401
    DatasetEntry,
    DatasetResume,
    DatasetJobDescription,
    DatasetMatchScore,
    DatasetLoadHistory,
)

# ── 추천 & 갭 & 포트폴리오 레이어 ────────────────────────────
from core.models_new import (           # noqa: F401
    SkillGap,
    ProblemRecommendation,
    PortfolioSnapshot,
    PortfolioFeedback,
)

# ── 문제 레이어 ───────────────────────────────────────────────
from core.models_problems import (      # noqa: F401
    JobProblem,
    JobProblemCluster,
    ProblemEdge,
    LearningPathMeta,
    JobProblemSolveHistory,
)

__all__ = [
    # 데이터셋
    'DatasetEntry', 'DatasetResume', 'DatasetJobDescription',
    'DatasetMatchScore', 'DatasetLoadHistory',
    # 추천 & 갭
    'SkillGap', 'ProblemRecommendation',
    'PortfolioSnapshot', 'PortfolioFeedback',
    # 문제
    'JobProblem', 'JobProblemCluster', 'ProblemEdge',
    'LearningPathMeta', 'JobProblemSolveHistory',
]