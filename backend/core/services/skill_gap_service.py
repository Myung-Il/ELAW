"""
core/services/skill_gap_service.py

스킬 갭 계산 서비스.

채용 공고의 required_skills와 사용자의 LearningStats / JobProblemSolveHistory를
비교하여 SkillGap을 계산하고 DB에 저장한다.
"""

from __future__ import annotations


class SkillGapService:
    """채용 공고 대비 사용자 스킬 갭 계산 서비스."""

    def calculate(self, user, posting) -> list:
        """
        posting.required_skills 리스트 vs 사용자의 LearningStats + JobProblemSolveHistory.
        각 skill에 대해 current_level(0~100), required_level(100), gap_score 계산.
        SkillGap.objects.update_or_create(user=user, posting=posting, skill_name=skill, ...).
        반환: SkillGap queryset list
        """
        from core.models_new import SkillGap

        required_skills = posting.required_skills or []
        if not required_skills:
            return []

        gaps = []
        for skill in required_skills:
            current_level = self._get_user_skill_level(user, skill)
            required_level = 100.0
            gap_score = required_level - current_level  # 양수 = 부족, 0 = 충족

            gap, _ = SkillGap.objects.update_or_create(
                user=user,
                posting=posting,
                skill_name=skill,
                defaults={
                    'current_level':        current_level,
                    'required_level':       required_level,
                    'gap_score':            gap_score,
                    'calculation_method':   'rule_based',
                },
            )
            gaps.append(gap)

        return gaps

    def recalculate_for_user(self, user):
        """사용자의 모든 활성 매칭 SkillGap 재계산."""
        from core.models import Match

        for match in Match.objects.filter(user=user).select_related('posting'):
            self.calculate(user, match.posting)

    def _get_user_skill_level(self, user, skill_name: str) -> float:
        """
        LearningStats에서 스킬명으로 correct_rate 찾기 (0~100).
        없으면 JobProblemSolveHistory의 해당 스킬 문제 정답률로 보정.
        그래도 없으면 0 반환.
        """
        from core.models import LearningStats
        from core.models_problems import JobProblemSolveHistory

        skill_lower = skill_name.lower()

        # 1. LearningStats에서 직접 스킬명 검색 (대소문자 무시)
        stat = (
            LearningStats.objects
            .filter(user=user, stat_type='algo_tag')
            .filter(stat_key__iexact=skill_name)
            .first()
        )
        if stat and stat.correct_rate is not None:
            return float(stat.correct_rate)

        # 2. 부분 문자열 일치 시도 (예: "Machine Learning" → "ML")
        for stat in LearningStats.objects.filter(user=user, stat_type='algo_tag'):
            if (skill_lower in stat.stat_key.lower() or
                    stat.stat_key.lower() in skill_lower):
                if stat.correct_rate is not None:
                    return float(stat.correct_rate)

        # 3. JobProblemSolveHistory에서 skills_required에 해당 스킬이 포함된 문제 정답률
        histories = (
            JobProblemSolveHistory.objects
            .filter(user=user)
            .select_related('problem')
        )
        total = 0
        correct = 0
        for h in histories:
            skills = [s.lower() for s in (h.problem.skills_required or [])]
            if any(skill_lower in s or s in skill_lower for s in skills):
                total += 1
                if h.status == 'correct':
                    correct += 1

        if total > 0:
            return round(correct / total * 100, 1)

        return 0.0
