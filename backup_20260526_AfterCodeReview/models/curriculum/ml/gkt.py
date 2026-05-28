class GKT:
    """
    Graph-based Knowledge Tracing
    
    dependency_graph 위에서 사용자 응답을 반영해
    각 노드(문제/스킬)의 숙련도를 업데이트하고
    미래 취약 가능성 점수를 반환하는 모델.

    사용 예시:
        gkt = GKT(responses, dependency_graph)
        score = gkt.predict(problem)
    """

    def __init__(self, responses: list, dependency_graph: dict):
        """
        Args:
            responses: 사용자 응답 이력
                       [{"question_id", "category", "subcategory", "is_correct"}, ...]
            dependency_graph: LearningPath의 dependency_graph
                              {"nodes": [...], "edges": [...]}
        """
        self._responses        = responses
        self._dependency_graph = dependency_graph
        self._category_stats   = self._build_category_stats()
        self._node_mastery     = self._build_node_mastery()
        self._weak_nodes       = self._build_weak_nodes()

    # ─────────────────────────────────────────
    # 내부: 카테고리별 통계 초기 계산 (증분 업데이트용)
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
    # 내부: 노드별 숙련도 계산
    #       정답률 기반으로 각 카테고리 숙련도 0~1
    # ─────────────────────────────────────────
    def _build_node_mastery(self) -> dict:
        return {
            cat: stats["correct"] / stats["total"]
            for cat, stats in self._category_stats.items()
        }

    # ─────────────────────────────────────────
    # 내부: 취약 노드 탐지
    #       틀린 노드의 선행 노드들을 취약점으로 마킹
    # ─────────────────────────────────────────
    def _build_weak_nodes(self) -> set:
        wrong_ids = {
            r["question_id"] for r in self._responses
            if not r["is_correct"]
        }

        weak_nodes = set(wrong_ids)

        edges = self._dependency_graph.get("edges", [])
        for edge in edges:
            if edge["Target_ID"] in wrong_ids:
                weak_nodes.add(edge["Preceding_ID"])

        return weak_nodes

    # ─────────────────────────────────────────
    # 공개: 새 응답 1건 증분 반영 (O(edges))
    # ─────────────────────────────────────────
    def update(self, response: dict) -> None:
        cat = response["category"]
        qid = response["question_id"]

        # 카테고리 통계 + 숙련도 증분 갱신
        if cat not in self._category_stats:
            self._category_stats[cat] = {"total": 0, "correct": 0}
        self._category_stats[cat]["total"] += 1
        if response["is_correct"]:
            self._category_stats[cat]["correct"] += 1
        self._node_mastery[cat] = (
            self._category_stats[cat]["correct"]
            / self._category_stats[cat]["total"]
        )

        # 오답이면 취약 노드 + 선행 노드 추가
        if not response["is_correct"]:
            self._weak_nodes.add(qid)
            for edge in self._dependency_graph.get("edges", []):
                if edge["Target_ID"] == qid:
                    self._weak_nodes.add(edge["Preceding_ID"])

    # ─────────────────────────────────────────
    # 공개: 문제별 미래 취약 가능성 점수 반환 (0~1)
    #       취약 노드 여부 + 카테고리 숙련도 반전
    # ─────────────────────────────────────────
    def predict(self, problem: dict) -> float:
        """
        Args:
            problem: {question_id, category, subcategory, difficulty, ...}
        Returns:
            float: 미래 취약 가능성 점수 (0~1, 높을수록 취약)
        """
        qid = problem["question_id"]
        cat = problem["category"]

        # 취약 노드면 높은 점수
        weak_score = 1.0 if qid in self._weak_nodes else 0.0

        # 카테고리 숙련도 반전 (숙련도 낮을수록 점수 높음)
        mastery = self._node_mastery.get(cat, 0.5)
        mastery_score = 1.0 - mastery

        return round((weak_score + mastery_score) / 2, 3)