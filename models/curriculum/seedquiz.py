class SeedQuiz:
    """
    사용자별 직군 시드 퀴즈 모듈

    외부(Django View 등)에서 DB 데이터를 받아 처리하는 순수 모듈.
    DB를 직접 참조하지 않음.

    사용 예시:
        # Django View에서
        problems = {p.original_question_id: p for p in JobProblem.objects.filter(job_role=job_role)}
        ordered_path = LearningPathMeta.objects.get(job_role=job_role).ordered_path

        quiz = SeedQuiz("홍길동", problems, ordered_path)
        question = quiz.get_question(0)
        quiz.submit(0, "Recall")
        result = quiz.get_result()
    """

    DIFFICULTY_CONFIG = {
        "university_level": 5,
        "junior_level": 3,
        "middle_level": 2
    }

    def __init__(self, username: str, problems: dict, ordered_path: list):
        """
        Args:
            username: 사용자 이름
            problems: {question_id: problem_dict} 형태의 문제 데이터
                      problem_dict 필수 키:
                        question_id, difficulty, category, subcategory,
                        question, choices, correct_answer, explanation
            ordered_path: 학습 순서 question_id 리스트
        """
        self.username = username
        self._problems = problems
        self._ordered_path = ordered_path
        self._seed_problems = self._sample_seed_problems()

        self._session = {
            "username": username,
            "total": len(self._seed_problems),
            "current_index": 0,
            "responses": []
        }

    # ─────────────────────────────────────────
    # 내부: 시드 문제 샘플링
    #       ordered_path 앞쪽 우선
    #       university 5 / junior 3 / middle 2
    #       senior 제외
    # ─────────────────────────────────────────
    def _sample_seed_problems(self) -> list:
        counts = {d: 0 for d in self.DIFFICULTY_CONFIG}
        seed_problems = []

        for qid in self._ordered_path:
            if qid not in self._problems:
                continue
            p = self._problems[qid]
            diff = p["difficulty"]
            if diff not in self.DIFFICULTY_CONFIG:
                continue
            if counts[diff] < self.DIFFICULTY_CONFIG[diff]:
                seed_problems.append(p)
                counts[diff] += 1
            if all(counts[d] >= self.DIFFICULTY_CONFIG[d] for d in self.DIFFICULTY_CONFIG):
                break

        return seed_problems

    # ─────────────────────────────────────────
    # 공개: 문제 조회
    # ─────────────────────────────────────────
    def get_question(self, index: int) -> dict:
        """
        index번째 문제 반환
        반환값: {question_id, index, total, difficulty, category, subcategory, question, choices}
        """
        if index < 0 or index >= len(self._seed_problems):
            raise IndexError(f"index는 0~{len(self._seed_problems)-1} 사이여야 합니다.")

        p = self._seed_problems[index]
        return {
            "question_id": p["question_id"],
            "index": index,
            "total": len(self._seed_problems),
            "difficulty": p["difficulty"],
            "category": p["category"],
            "subcategory": p["subcategory"],
            "question": p["question"],
            "choices": p["choices"]
        }

    def get_all_questions(self) -> list:
        """전체 시드 문제 목록 반환"""
        return [self.get_question(i) for i in range(len(self._seed_problems))]

    # ─────────────────────────────────────────
    # 공개: 답 제출
    # ─────────────────────────────────────────
    def submit(self, index: int, answer: str) -> dict:
        """
        index번째 문제에 답 제출
        Args:
            index: 문제 인덱스
            answer: 선택지 문자열 (예: "Recall")
        반환값: {is_correct, correct_answer, explanation}
        """
        if index < 0 or index >= len(self._seed_problems):
            raise IndexError(f"index는 0~{len(self._seed_problems)-1} 사이여야 합니다.")

        p = self._seed_problems[index]
        is_correct = answer == p["correct_answer"]

        response = {
            "question_id": p["question_id"],
            "index": index,
            "category": p["category"],
            "subcategory": p["subcategory"],
            "difficulty": p["difficulty"],
            "user_answer": answer,
            "correct_answer": p["correct_answer"],
            "is_correct": is_correct
        }

        # 이미 제출한 문제면 덮어쓰기
        existing = [r for r in self._session["responses"] if r["index"] == index]
        if existing:
            self._session["responses"] = [
                response if r["index"] == index else r
                for r in self._session["responses"]
            ]
        else:
            self._session["responses"].append(response)

        self._session["current_index"] = max(self._session["current_index"], index + 1)

        return {
            "is_correct": is_correct,
            "correct_answer": p["correct_answer"],
            "explanation": p["explanation"]
        }

    # ─────────────────────────────────────────
    # 공개: 진행 상태 조회
    # ─────────────────────────────────────────
    def get_progress(self) -> dict:
        """현재 진행 상태 반환"""
        answered = len(self._session["responses"])
        correct = sum(1 for r in self._session["responses"] if r["is_correct"])
        return {
            "username": self.username,
            "answered": answered,
            "total": self._session["total"],
            "correct": correct,
            "accuracy": correct / answered * 100 if answered > 0 else 0.0,
            "is_completed": answered >= self._session["total"]
        }

    # ─────────────────────────────────────────
    # 공개: 최종 결과 반환 (voting.py로 넘길 데이터)
    # ─────────────────────────────────────────
    def get_result(self) -> dict:
        """
        전체 결과 반환
        반환값: {username, total, correct, accuracy, responses}
        """
        correct = sum(1 for r in self._session["responses"] if r["is_correct"])
        total = self._session["total"]
        return {
            "username": self.username,
            "total": total,
            "correct": correct,
            "accuracy": correct / total * 100 if total > 0 else 0.0,
            "responses": self._session["responses"]
        }

    # ─────────────────────────────────────────
    # 공개: 세션 내보내기 / 불러오기 (이어풀기)
    # ─────────────────────────────────────────
    def export_session(self) -> dict:
        """세션 딕셔너리 반환 (외부 저장용)"""
        return dict(self._session)

    def import_session(self, session: dict):
        """외부에서 저장된 세션 불러오기 (이어풀기)"""
        self._session = session