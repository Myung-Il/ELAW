class SAKT:
    """
    Self-Attentive Knowledge Tracing

    사용자의 과거 응답 시퀀스에서
    현재 문제와의 연관성을 Self-Attention 방식으로 계산해
    과거 패턴 기반 연관성 점수를 반환하는 모델.

    사용 예시:
        sakt = SAKT(responses)
        score = sakt.predict(problem)
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
    # 내부: 최근 window개 응답 기준 카테고리 가중치 계산
    #       최근일수록 높은 가중치 (선형 감쇠)
    # ─────────────────────────────────────────
    def _attention_weights(self) -> dict:
        recent = self._responses[-self._window:]
        n = len(recent)
        if n == 0:
            return {}

        category_weights = {}
        for i, r in enumerate(recent):
            cat = r["category"]
            weight = (i + 1) / n  # 최근일수록 높은 가중치
            if cat not in category_weights:
                category_weights[cat] = 0.0
            category_weights[cat] += weight

        # 정규화
        total = sum(category_weights.values())
        if total > 0:
            category_weights = {
                cat: w / total
                for cat, w in category_weights.items()
            }

        return category_weights

    # ─────────────────────────────────────────
    # 공개: 문제별 과거 패턴 기반 연관성 점수 반환 (0~1)
    # ─────────────────────────────────────────
    def predict(self, problem: dict) -> float:
        """
        Args:
            problem: {question_id, category, subcategory, difficulty, ...}
        Returns:
            float: 과거 패턴 기반 연관성 점수 (0~1)
        """
        if not self._responses:
            return 0.0

        weights = self._attention_weights()
        cat = problem["category"]
        return round(weights.get(cat, 0.0), 3)