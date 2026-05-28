class DKT:
    """
    Deep Knowledge Tracing

    사용자의 응답 시퀀스를 기반으로
    각 문제를 맞출 확률을 예측하는 모델.
    최근 응답일수록 높은 가중치를 부여해 시퀀스 흐름을 반영한다.

    사용 예시:
        dkt = DKT(responses)
        score = dkt.predict(problem)
    """

    def __init__(self, responses: list, window: int = 10):
        """
        Args:
            responses: 사용자 응답 이력
                       [{"question_id", "category", "subcategory", "is_correct"}, ...]
            window: 참고할 최근 응답 수 (기본 10개)
        """
        self._responses = responses
        self._window    = window

    # ─────────────────────────────────────────
    # 내부: 카테고리별 가중 정답률 계산
    #       최근 응답일수록 높은 가중치 (선형 증가)
    # ─────────────────────────────────────────
    def _build_weighted_stats(self) -> dict:
        recent = self._responses[-self._window:]
        n = len(recent)
        if n == 0:
            return {}

        stats = {}
        for i, r in enumerate(recent):
            cat = r["category"]
            weight = (i + 1) / n  # 최근일수록 높은 가중치
            if cat not in stats:
                stats[cat] = {"weight_sum": 0.0, "correct_sum": 0.0}
            stats[cat]["weight_sum"]  += weight
            if r["is_correct"]:
                stats[cat]["correct_sum"] += weight

        return stats

    # ─────────────────────────────────────────
    # 공개: 새 응답 1건 증분 반영 (O(1))
    # ─────────────────────────────────────────
    def update(self, response: dict) -> None:
        cat = response["category"]
        if cat not in self._category_stats:
            self._category_stats[cat] = {"total": 0, "correct": 0}
        self._category_stats[cat]["total"] += 1
        if response["is_correct"]:
            self._category_stats[cat]["correct"] += 1

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
        if not self._responses:
            return 0.5  # 데이터 없으면 중립값

        stats = self._build_weighted_stats()
        cat = problem["category"]

        if cat not in stats:
            return 0.5  # 해당 카테고리 응답 없으면 중립값

        s = stats[cat]
        return round(s["correct_sum"] / s["weight_sum"], 3)