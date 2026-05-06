"""
core/services/recommender_service.py

Django ORM 기반 문제 추천 서비스.
models/recommender.py의 BKTModel 로직을 ORM으로 래핑한다.

BKT 상태는 파일 대신 JobProblemSolveHistory ORM에서 history replay로 재구성한다.
DKT는 풀이 기록 >= 30개일 때 시도하며, 실패 시 BKT로 폴백한다.
"""

from __future__ import annotations

import math
import os
import sys

# models/recommender.py 임포트 (ELAW/models/ 폴더)
_MODELS_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'models')
)
if _MODELS_DIR not in sys.path:
    sys.path.insert(0, _MODELS_DIR)

from recommender import BKTModel, DIFFICULTY_KOR, QUESTION_TYPE_KOR, _make_reason  # noqa: E402

try:
    from dkt import DKTModel, MIN_RECORDS  # noqa: E402
    _DKT_AVAILABLE = True
except Exception:
    _DKT_AVAILABLE = False
    MIN_RECORDS = 30


class RecommenderService:
    """
    Django ORM 기반 추천 서비스.

    JobProblem ORM으로 문제를 로드하고,
    JobProblemSolveHistory ORM으로 BKT 상태를 재구성한 뒤
    ProblemEdge centrality를 반영한 최종 추천 목록을 반환한다.
    """

    # ── BKT 재구성 ─────────────────────────────

    def _rebuild_bkt(self, user, job_role: str) -> BKTModel:
        """JobProblemSolveHistory를 시간순으로 재생해 BKT 상태 재구성."""
        from core.models_problems import JobProblemSolveHistory

        bkt = BKTModel()
        histories = (
            JobProblemSolveHistory.objects
            .filter(user=user, problem__job_role=job_role)
            .select_related('problem')
            .order_by('solved_at')
        )
        for h in histories:
            bkt.update(h.problem.original_question_id, h.status == 'correct')
        return bkt

    def _rebuild_dkt(self, user, job_role: str):
        """DKT가 가용할 때 JobProblemSolveHistory 재생으로 DKT 상태 재구성."""
        if not _DKT_AVAILABLE:
            return None
        from core.models_problems import JobProblemSolveHistory

        dkt = DKTModel()
        histories = (
            JobProblemSolveHistory.objects
            .filter(user=user, problem__job_role=job_role)
            .select_related('problem')
            .order_by('solved_at')
        )
        for h in histories:
            prob_dict = {
                'question_id':   h.problem.original_question_id,
                'difficulty':    h.problem.difficulty,
                'question_type': h.problem.question_type,
                'category':      h.problem.category,
                'skills_required': h.problem.skills_required or [],
            }
            dkt.add_record(prob_dict, h.status == 'correct')

        if len(dkt) >= MIN_RECORDS:
            try:
                dkt.train()
            except Exception:
                pass
        return dkt

    # ── 핵심 추천 ──────────────────────────────

    def recommend(self, user, job_role: str, top_n: int = 10) -> list[dict]:
        """
        1. JobProblem.objects.filter(job_role=job_role) 로 문제 로드
        2. JobProblemSolveHistory로 BKT 상태 재구성 (history replay)
        3. ProblemEdge로 centrality 계산
        4. 풀이 기록 >= 30이면 DKT 시도 (실패시 BKT fallback)
        5. ProblemRecommendation 저장 (update_or_create)
        6. 추천 결과 반환
        """
        from core.models_problems import JobProblem, ProblemEdge
        from core.models_new import ProblemRecommendation

        # 1. 문제 로드
        problems_qs = JobProblem.objects.filter(job_role=job_role)
        if not problems_qs.exists():
            return []

        # 2. BKT 재구성
        bkt = self._rebuild_bkt(user, job_role)

        # 3. DKT 시도
        use_dkt = False
        dkt = None
        if _DKT_AVAILABLE:
            try:
                dkt = self._rebuild_dkt(user, job_role)
                use_dkt = (dkt is not None and len(dkt) >= MIN_RECORDS)
            except Exception:
                use_dkt = False

        # 4. edge centrality 계산 (target_problem에 연결되는 edge combined_score 합산)
        edge_weight: dict[int, float] = {}
        for edge in ProblemEdge.objects.filter(job_role=job_role).values(
            'target_problem_id', 'combined_score'
        ):
            tgt_pk = edge['target_problem_id']
            edge_weight[tgt_pk] = edge_weight.get(tgt_pk, 0.0) + edge['combined_score']

        # 5. 점수 계산 및 정렬
        candidates = []
        for prob in problems_qs:
            qid = prob.original_question_id
            prob_dict = {
                'question_id':   qid,
                'difficulty':    prob.difficulty,
                'question_type': prob.question_type,
                'category':      prob.category,
                'skills_required': prob.skills_required or [],
            }
            if use_dkt:
                try:
                    weakness = dkt.weakness_score(prob_dict)
                except Exception:
                    weakness = bkt.weakness_score(qid)
                    use_dkt = False
            else:
                weakness = bkt.weakness_score(qid)

            centrality = min(edge_weight.get(prob.pk, 0.0) * 0.1, 0.2)
            candidates.append({
                'prob':        prob,
                'qid':         qid,
                'final_score': weakness + centrality,
                'use_dkt':     use_dkt,
            })

        candidates.sort(key=lambda x: -x['final_score'])
        top = candidates[:top_n]

        # 6. 결과 구성 및 ProblemRecommendation 저장
        results = []
        for rank, c in enumerate(top, 1):
            prob = c['prob']
            qid  = c['qid']
            if use_dkt and dkt is not None:
                try:
                    mastery_pct = round((1.0 - dkt.weakness_score({
                        'question_id':   qid,
                        'difficulty':    prob.difficulty,
                        'question_type': prob.question_type,
                        'category':      prob.category,
                        'skills_required': prob.skills_required or [],
                    })) * 100, 1)
                    model_tag = 'DKT'
                except Exception:
                    mastery_pct = round(bkt.mastery(qid) * 100, 1)
                    model_tag = 'BKT'
            else:
                mastery_pct = round(bkt.mastery(qid) * 100, 1)
                model_tag = 'BKT'

            reason = _make_reason(mastery_pct, bkt.attempts(qid), model_tag)

            # ProblemRecommendation 저장
            try:
                ProblemRecommendation.objects.update_or_create(
                    user=user,
                    platform='baekjoon',       # JobProblem은 자체 플랫폼이지만 필드 제약상 값 필요
                    problem_id=str(prob.pk),   # DB PK를 problem_id로 사용
                    posting=None,
                    defaults={
                        'title':           prob.question[:300],
                        'algo_tags':       prob.skills_required or [],
                        'difficulty':      prob.difficulty,
                        'relevance_score': min(c['final_score'], 1.0),
                        'reason':          reason,
                        'model_version':   f'{model_tag}-v1.0',
                        'status':          ProblemRecommendation.Status.PENDING,
                    }
                )
            except Exception:
                pass  # 추천 저장 실패가 추천 결과를 막으면 안 됨

            results.append({
                'rank':                  rank,
                'problem_id':            prob.pk,
                'original_question_id':  qid,
                'job_role':              prob.job_role,
                'difficulty':            DIFFICULTY_KOR.get(prob.difficulty, prob.difficulty),
                'question_type':         QUESTION_TYPE_KOR.get(
                                             prob.question_type or '', prob.question_type or ''
                                         ),
                'category':              prob.category,
                'subcategory':           prob.subcategory,
                'scenario':              prob.scenario,
                'question':              prob.question,
                'choices':               prob.choices,
                'skills_required':       prob.skills_required or [],
                'estimated_mastery_pct': mastery_pct,
                'model':                 model_tag,
                'reason':                reason,
            })

        return results

    # ── 답변 기록 ─────────────────────────────

    def record_answer(self, user, problem_id: int, is_correct: bool) -> dict:
        """
        JobProblemSolveHistory 저장 (중복 허용 - 재시도 가능).
        반환: {mastery_pct, is_correct, explanation}
        """
        from core.models_problems import JobProblem, JobProblemSolveHistory

        problem = JobProblem.objects.get(pk=problem_id)
        status  = JobProblemSolveHistory.Status.CORRECT if is_correct else \
                  JobProblemSolveHistory.Status.INCORRECT

        # 중복 허용: 같은 문제를 여러 번 풀 수 있음 (재시도)
        JobProblemSolveHistory.objects.create(
            user=user,
            problem=problem,
            status=status,
        )

        # BKT 재구성으로 현재 mastery 계산
        bkt = self._rebuild_bkt(user, problem.job_role)
        mastery_pct = round(bkt.mastery(problem.original_question_id) * 100, 1)

        return {
            'mastery_pct': mastery_pct,
            'is_correct':  is_correct,
            'explanation': problem.explanation or '',
        }
