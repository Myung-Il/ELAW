class Voting:
    """
    Soft Voting 기반 구간 판별 및 가중치 관리 모듈

    외부(Django View 등)에서 SeedQuiz.get_result()를 받아 처리하는 순수 모듈.

    사용 예시:
        result = quiz.get_result()
        voting = Voting(result)

        voting.get_zone()             # "낮음" / "괜찮음" / "높음"
        voting.get_weights()          # {"DKT": 0.4, "SAKT": 0.2, "GKT": 0.4}
        voting.get_weak_categories()  # {"Machine Learning": 0.33, ...}
        voting.update(is_correct)     # 매 문제마다 호출
        voting.get_status()           # 전체 상태 한번에 반환
    """

    # 구간 경계값
    ZONE_LOW    = 60.0   # 60% 미만 → 낮음
    ZONE_MID    = 77.0   # 60~77% → 괜찮음, 77% 이상 → 높음

    # 구간별 보팅 비율 (DKT, SAKT, GKT)
    WEIGHTS = {
        "낮음":   {"DKT": 0.4, "SAKT": 0.2, "GKT": 0.4},
        "괜찮음": {"DKT": 0.35, "SAKT": 0.2, "GKT": 0.45},
        "높음":   {"DKT": 0.3,  "SAKT": 0.2, "GKT": 0.5}
    }

    def __init__(self, result: dict):
        """
        Args:
            result: SeedQuiz.get_result() 반환값
                    필수 키: total, correct, accuracy, responses
        """
        self._total    = result["total"]
        self._correct  = result["correct"]
        self._accuracy = result["accuracy"]
        self._responses = result["responses"]

    # ─────────────────────────────────────────
    # 내부: 정확도 → 구간 판별
    # ─────────────────────────────────────────
    def _calc_zone(self, accuracy: float) -> str:
        if accuracy < self.ZONE_LOW:
            return "낮음"
        elif accuracy < self.ZONE_MID:
            return "괜찮음"
        else:
            return "높음"

    # ─────────────────────────────────────────
    # 공개: 구간 반환
    # ─────────────────────────────────────────
    def get_zone(self) -> str:
        """현재 정답률 기준 구간 반환 (낮음 / 괜찮음 / 높음)"""
        return self._calc_zone(self._accuracy)

    # ─────────────────────────────────────────
    # 공개: 보팅 비율 반환
    # ─────────────────────────────────────────
    def get_weights(self) -> dict:
        """현재 구간의 DKT/SAKT/GKT 보팅 비율 반환"""
        return dict(self.WEIGHTS[self.get_zone()])

    # ─────────────────────────────────────────
    # 공개: 카테고리별 취약점 분석
    # ─────────────────────────────────────────
    def get_weak_categories(self) -> dict:
        """
        카테고리별 오답률 반환
        반환값: {category: 오답률} 내림차순 정렬
        """
        category_stats = {}

        for r in self._responses:
            cat = r["category"]
            if cat not in category_stats:
                category_stats[cat] = {"total": 0, "wrong": 0}
            category_stats[cat]["total"] += 1
            if not r["is_correct"]:
                category_stats[cat]["wrong"] += 1

        weak = {
            cat: round(stats["wrong"] / stats["total"], 2)
            for cat, stats in category_stats.items()
            if stats["wrong"] > 0
        }

        return dict(sorted(weak.items(), key=lambda x: x[1], reverse=True))

    # ─────────────────────────────────────────
    # 공개: 매 문제마다 누적 정답률 업데이트
    # ─────────────────────────────────────────
    def update(self, is_correct: bool):
        """
        문제를 한 개 풀 때마다 호출
        누적 정답률 재계산 → 구간 자동 갱신
        """
        self._total += 1
        if is_correct:
            self._correct += 1
        self._accuracy = self._correct / self._total * 100

    # ─────────────────────────────────────────
    # 공개: 전체 상태 반환 (recommend.py로 넘길 데이터)
    # ─────────────────────────────────────────
    def get_status(self) -> dict:
        """
        현재 전체 상태 반환
        반환값: {accuracy, zone, weights, weak_categories}
        """
        return {
            "accuracy": round(self._accuracy, 1),
            "zone": self.get_zone(),
            "weights": self.get_weights(),
            "weak_categories": self.get_weak_categories()
        }