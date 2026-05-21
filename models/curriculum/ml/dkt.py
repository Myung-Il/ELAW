class DKT:
    """
    Deep Knowledge Tracing

    사용자의 응답 시퀀스를 기반으로
    각 문제를 맞출 확률을 예측하는 모델.

    사용 예시:
        dkt = DKT(responses)
        score = dkt.predict(problem)
    """

    def __init__(self, responses: list):
        """
        Args:
            responses: 사용자 응답 이력
                       [{"question_id", "category", "subcategory", "is_correct"}, ...]
        """
        self._responses       = responses
        self._category_stats  = self._build_category_stats()

    # ─────────────────────────────────────────
    # 내부: 카테고리별 정답률 계산
    # ─────────────────────────────────────────
    def _build_category_stats(self) -> dict:
        stats = {}
        for r in self._responses:
            cat = r["category"]
            if cat not in stats:
                stats[cat] = {"total": 0, "correct": 0}
            stats[cat]["total"] += 1
            if r["is_correct"]:
                stats[cat]["correct"] += 1
        return stats

    # ─────────────────────────────────────────
    # 공개: 문제별 예상 정답 확률 반환 (0~1)
    # ─────────────────────────────────────────
    def predict(self, problem: dict) -> float:
        """
        Args:
            problem: {question_id, category, subcategory, difficulty, ...}
        Returns:
            float: 예상 정답 확률 (0~1, 높을수록 잘 풀 수 있는 문제)
        """
        cat = problem["category"]
        if cat not in self._category_stats:
            return 0.5  # 데이터 없으면 중립값

        stats = self._category_stats[cat]
        return round(stats["correct"] / stats["total"], 3)