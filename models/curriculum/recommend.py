from ml.gkt import GKT
from ml.sakt import SAKT
from ml.dkt import DKT

class Recommend:
    """
    GKT + SAKT + DKT Soft Voting 기반 문제 추천 모듈

    사용 예시:
        status = voting.get_status()
        recommend = Recommend(status, problems, responses, dependency_graph)
        recommend.get_recommendations(top_n=5)
        recommend.update(question_id, is_correct, category, subcategory)
    """

    def __init__(self, status: dict, problems: dict, responses: list, dependency_graph: dict):
        """
        Args:
            status: Voting.get_status() 반환값
            problems: {question_id: problem_dict} 전체 문제 데이터
            responses: 사용자 응답 이력
            dependency_graph: LearningPath의 dependency_graph
        """
        self._zone            = status["zone"]
        self._weights         = status["weights"]
        self._weak_categories = status["weak_categories"]
        self._problems        = problems
        self._responses       = responses
        self._dependency_graph = dependency_graph
        self._answered_ids    = {r["question_id"] for r in responses}

        # 분류기 초기화
        self._classifiers = [
            ("GKT",  GKT(responses, dependency_graph)),
            ("SAKT", SAKT(responses)),
            ("DKT",  DKT(responses))
        ]

    # ─────────────────────────────────────────
    # 내부: 이미 푼 문제 제외한 후보 목록
    # ─────────────────────────────────────────
    def _get_candidates(self) -> list:
        return [
            p for qid, p in self._problems.items()
            if qid not in self._answered_ids
        ]

    # ─────────────────────────────────────────
    # 내부: Soft Voting 점수 계산
    # ─────────────────────────────────────────
    def _soft_voting_score(self, problem: dict) -> dict:
        w = self._weights
        scores = {}
        for name, clf in self._classifiers:
            scores[name] = clf.predict(problem)

        scores["total"] = round(
            w["GKT"]  * scores["GKT"] +
            w["SAKT"] * scores["SAKT"] +
            w["DKT"]  * scores["DKT"],
            3
        )
        return scores

    # ─────────────────────────────────────────
    # 공개: 추천 문제 목록 반환
    # ─────────────────────────────────────────
    def get_recommendations(self, top_n: int = 5) -> list:
        """
        Soft Voting 점수 기준 상위 top_n개 문제 추천
        반환값: [{question_id, category, subcategory, difficulty, question, choices, scores}]
        """
        candidates = self._get_candidates()
        if not candidates:
            return []

        scored = []
        for p in candidates:
            scores = self._soft_voting_score(p)
            scored.append({
                "question_id": p["question_id"],
                "category":    p["category"],
                "subcategory": p["subcategory"],
                "difficulty":  p["difficulty"],
                "question":    p["question"],
                "choices":     p["choices"],
                "scores":      {k: round(v, 3) for k, v in scores.items()}
            })

        scored.sort(key=lambda x: x["scores"]["total"], reverse=True)
        return scored[:top_n]

    # ─────────────────────────────────────────
    # 공개: 문제 풀고 나서 상태 업데이트
    # ─────────────────────────────────────────
    def update(self, question_id: int, is_correct: bool, category: str, subcategory: str):
        """문제를 한 개 풀 때마다 호출 — 응답 이력 추가 후 분류기 재초기화"""
        self._answered_ids.add(question_id)
        self._responses.append({
            "question_id": question_id,
            "category":    category,
            "subcategory": subcategory,
            "is_correct":  is_correct
        })

        # 분류기 재초기화 (새 응답 반영)
        self._classifiers = [
            ("GKT",  GKT(self._responses, self._dependency_graph)),
            ("SAKT", SAKT(self._responses)),
            ("DKT",  DKT(self._responses))
        ]

    # ─────────────────────────────────────────
    # 공개: 현재 상태 반환
    # ─────────────────────────────────────────
    def get_status(self) -> dict:
        return {
            "zone":            self._zone,
            "weights":         self._weights,
            "weak_categories": self._weak_categories,
            "answered_count":  len(self._answered_ids),
            "remaining_count": len(self._get_candidates())
        }