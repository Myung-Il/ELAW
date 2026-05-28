"""
core/utils_ability.py

능력 수치화 & 포트폴리오 생성 유틸리티

흐름:
  1. AbilityCalculator
     - job_problem_solve_history + solve_history(백준/GitHub) 통합 분석
     - 스킬별 현재 수준 (0~100) 산출
     - SkillGap 자동 재계산

  2. PortfolioBuilder
     - structured_resume (dataset_resumes 또는 사용자 입력)
     - skill_analysis (SkillGap 결과)
     - problem_history (JobProblemSolveHistory 요약)
     → PortfolioSnapshot 생성 (Gemini or 자체 모델)

  3. RLHFCollector
     - PortfolioFeedback 저장
     - used_for_training 플래그 관리
     - 학습 배치 데이터 추출
"""

import time
import json
import requests
from django.conf import settings
from django.utils import timezone
from django.db.models import Count, Avg, Q


# ══════════════════════════════════════════════
# 1. 능력 수치화
# ══════════════════════════════════════════════

class AbilityCalculator:
    """
    사용자의 풀이 이력을 분석하여 스킬별 현재 수준을 계산합니다.

    사용 예시:
        calc = AbilityCalculator(user)
        result = calc.calculate()
        # result = {
        #   "skills": {"Python": 75.0, "DP": 60.0, ...},
        #   "overall": 67.5,
        #   "by_difficulty": {"junior_level": 80.0, "middle_level": 55.0},
        #   "weak_skills": ["DP", "Graph"],
        #   "strong_skills": ["Python", "SQL"]
        # }
    """

    def __init__(self, user):
        self.user = user

    def calculate(self):
        """전체 능력 수치화 실행"""
        from core.models_problems import JobProblem, JobProblemSolveHistory
        from core.models import LearningStats

        # ── 1. 자체 문제 풀이 기반 스킬 수준 ──────────────
        jp_stats = self._calc_from_job_problems()

        # ── 2. 백준/외부 풀이 기반 알고리즘 태그 수준 ──────
        ext_stats = self._calc_from_external()

        # ── 3. 통합 (자체 문제 60% + 외부 40%) ─────────────
        all_skills = set(jp_stats.keys()) | set(ext_stats.keys())
        merged = {}
        for skill in all_skills:
            jp_val  = jp_stats.get(skill, None)
            ext_val = ext_stats.get(skill, None)
            if jp_val is not None and ext_val is not None:
                merged[skill] = round(jp_val * 0.6 + ext_val * 0.4, 2)
            elif jp_val is not None:
                merged[skill] = jp_val
            else:
                merged[skill] = ext_val

        # ── 4. 강점 / 취약점 분류 ─────────────────────────
        sorted_skills = sorted(merged.items(), key=lambda x: -x[1])
        strong_skills = [s for s, v in sorted_skills if v >= 70][:5]
        weak_skills   = [s for s, v in sorted_skills if v < 50][:5]

        # ── 5. 난이도별 수준 ───────────────────────────────
        by_difficulty = self._calc_by_difficulty()

        overall = round(sum(merged.values()) / len(merged), 2) if merged else 0.0

        return {
            "skills":        merged,
            "overall":       overall,
            "by_difficulty": by_difficulty,
            "strong_skills": strong_skills,
            "weak_skills":   weak_skills,
            "total_solved":  self._total_solved(),
        }

    def _calc_from_job_problems(self):
        """자체 문제 풀이 기반 스킬 수준 계산"""
        from core.models_problems import JobProblemSolveHistory, JobProblem

        histories = JobProblemSolveHistory.objects.filter(
            user=self.user
        ).select_related('problem')

        skill_stats = {}
        for h in histories:
            for skill in (h.problem.skills_required or []):
                if skill not in skill_stats:
                    skill_stats[skill] = {'total': 0, 'correct': 0}
                skill_stats[skill]['total'] += 1
                if h.status == 'correct':
                    skill_stats[skill]['correct'] += 1

        return {
            skill: round(v['correct'] / v['total'] * 100, 2)
            for skill, v in skill_stats.items()
            if v['total'] > 0
        }

    def _calc_from_external(self):
        """백준/외부 풀이 기반 알고리즘 태그 수준 계산"""
        from core.models import LearningStats

        result = {}
        for stat in LearningStats.objects.filter(
            user=self.user, stat_type='algo_tag'
        ):
            result[stat.stat_key] = stat.correct_rate or 0.0
        return result

    def _calc_by_difficulty(self):
        """난이도별 정답률"""
        from core.models_problems import JobProblemSolveHistory

        result = {}
        for diff in ['university_level', 'junior_level',
                     'middle_level', 'senior_level']:
            qs = JobProblemSolveHistory.objects.filter(
                user=self.user,
                problem__difficulty=diff
            )
            total   = qs.count()
            correct = qs.filter(status='correct').count()
            if total > 0:
                result[diff] = round(correct / total * 100, 2)
        return result

    def _total_solved(self):
        from core.models_problems import JobProblemSolveHistory
        from core.models import SolveHistory
        jp = JobProblemSolveHistory.objects.filter(
            user=self.user, status='correct'
        ).count()
        ext = SolveHistory.objects.filter(
            user=self.user, status='solved'
        ).count()
        return {'job_problems': jp, 'external': ext, 'total': jp + ext}

    def update_skill_gaps(self, posting):
        """능력 수치화 결과로 SkillGap 재계산"""
        from core.models_new import SkillGap

        ability = self.calculate()
        current_skills = ability['skills']

        req_skills = posting.required_skills or []
        pref_skills = posting.preferred_skills or []

        gaps = []
        for skill in req_skills + pref_skills:
            current  = current_skills.get(skill, 0.0)
            required = 80.0 if skill in req_skills else 60.0
            gap      = round(required - current, 2)

            obj, _ = SkillGap.objects.update_or_create(
                user=self.user, posting=posting, skill_name=skill,
                defaults={
                    'skill_category':    'required' if skill in req_skills else 'preferred',
                    'current_level':     current,
                    'required_level':    required,
                    'gap_score':         gap,
                    'calculation_method': 'rule_based',
                }
            )
            gaps.append(obj)

        return gaps


# ══════════════════════════════════════════════
# 2. 포트폴리오 생성
# ══════════════════════════════════════════════

class PortfolioBuilder:
    """
    능력 수치화 결과 + 구조화 이력서 → 포트폴리오 스냅샷 생성.

    사용 예시:
        builder = PortfolioBuilder(user, portfolio, posting)
        snapshot = builder.build(method='gemini')
    """

    def __init__(self, user, portfolio, posting=None):
        self.user      = user
        self.portfolio = portfolio
        self.posting   = posting

    def build(self, method='gemini'):
        """포트폴리오 스냅샷 생성"""
        from core.models_new import PortfolioSnapshot
        from core.models_dataset import DatasetResume

        # ── 입력 데이터 수집 ────────────────────────────
        structured_resume = self._get_structured_resume()
        skill_analysis    = self._get_skill_analysis()
        problem_history   = self._get_problem_history()

        # ── 포트폴리오 생성 ─────────────────────────────
        if method == 'gemini':
            content, prompt = self._generate_with_gemini(
                structured_resume, skill_analysis, problem_history
            )
        else:
            content = self._generate_rule_based(
                structured_resume, skill_analysis, problem_history
            )
            prompt = None

        # ── 버전 관리 ───────────────────────────────────
        last_version = PortfolioSnapshot.objects.filter(
            portfolio=self.portfolio
        ).order_by('-version').values_list('version', flat=True).first() or 0

        # 기존 최종 버전 해제
        PortfolioSnapshot.objects.filter(
            portfolio=self.portfolio, is_final=True
        ).update(is_final=False)

        snapshot = PortfolioSnapshot.objects.create(
            portfolio         = self.portfolio,
            user              = self.user,
            posting           = self.posting,
            structured_resume = structured_resume,
            skill_analysis    = skill_analysis,
            problem_history   = problem_history,
            generated_content = content,
            generation_method = method,
            generation_prompt = prompt,
            version           = last_version + 1,
            is_final          = True,
        )
        return snapshot

    def _get_structured_resume(self):
        """DatasetResume 또는 Portfolio.content_json에서 이력서 구조화 데이터 추출"""
        from core.models_dataset import DatasetResume

        # 1순위: 딥러닝 모델이 파싱한 DatasetResume (같은 job_role)
        # 2순위: 기존 Portfolio.content_json
        resume_data = {
            'name':    self.user.name,
            'email':   self.user.email,
            'skills':  [],
            'experience': [],
        }
        if self.portfolio.content_json:
            sections = self.portfolio.content_json.get('sections', [])
            for sec in sections:
                if sec.get('type') == 'skills':
                    resume_data['skills'] = sec.get('items', [])
                elif sec.get('type') == 'github':
                    resume_data['github'] = sec.get('username')
        return resume_data

    def _get_skill_analysis(self):
        """SkillGap 분석 결과 요약"""
        from core.models_new import SkillGap

        calc   = AbilityCalculator(self.user)
        ability = calc.calculate()

        gaps = []
        if self.posting:
            qs = SkillGap.objects.filter(
                user=self.user, posting=self.posting
            ).order_by('-gap_score')
            gaps = list(qs.values('skill_name', 'current_level',
                                  'required_level', 'gap_score'))

        return {
            'overall_score':   ability['overall'],
            'strong_skills':   ability['strong_skills'],
            'weak_skills':     ability['weak_skills'],
            'by_difficulty':   ability['by_difficulty'],
            'skill_scores':    ability['skills'],
            'gaps':            gaps,
        }

    def _get_problem_history(self):
        """풀이 이력 요약 — 포트폴리오 '능력 향상' 섹션용"""
        from core.models_problems import JobProblemSolveHistory
        from core.models import SolveHistory

        # 자체 문제
        jp_total   = JobProblemSolveHistory.objects.filter(user=self.user).count()
        jp_correct = JobProblemSolveHistory.objects.filter(
            user=self.user, status='correct'
        ).count()

        # 외부 문제 (백준)
        ext_total  = SolveHistory.objects.filter(user=self.user).count()
        ext_solved = SolveHistory.objects.filter(
            user=self.user, status='solved'
        ).count()

        # 최근 푼 문제 Top5
        recent = list(
            JobProblemSolveHistory.objects.filter(
                user=self.user, status='correct'
            ).select_related('problem').order_by('-solved_at')[:5].values(
                'problem__job_role', 'problem__category',
                'problem__difficulty', 'solved_at'
            )
        )

        return {
            'job_problems': {
                'total':        jp_total,
                'correct':      jp_correct,
                'correct_rate': round(jp_correct / jp_total * 100, 1) if jp_total else 0,
            },
            'external': {
                'total':  ext_total,
                'solved': ext_solved,
            },
            'total_solved': jp_correct + ext_solved,
            'recent_solved': recent,
        }

    def _generate_with_gemini(self, resume, skill, history):
        """Gemini API로 포트폴리오 생성"""
        key = getattr(settings, 'GEMINI_API_KEY', '')
        if not key:
            return self._generate_rule_based(resume, skill, history), None

        posting_info = ""
        if self.posting:
            posting_info = (
                f"목표 채용공고: {self.posting.title}\n"
                f"필수 스킬: {self.posting.required_skills}\n"
            )

        prompt = f"""당신은 ELAW 플랫폼의 포트폴리오 생성 AI입니다.
아래 사용자 데이터를 바탕으로 전문적인 포트폴리오를 JSON으로 생성해주세요.

[사용자 정보]
이름: {resume.get('name')}
이메일: {resume.get('email')}
보유 스킬: {resume.get('skills', [])}

[능력 분석]
전체 점수: {skill.get('overall_score')}점
강점 스킬: {skill.get('strong_skills')}
취약 스킬: {skill.get('weak_skills')}
난이도별 정답률: {skill.get('by_difficulty')}

[문제 풀이 이력]
자체 문제 풀이: {history['job_problems']['total']}문제 중 {history['job_problems']['correct']}개 정답 ({history['job_problems']['correct_rate']}%)
백준 풀이: {history['external']['solved']}문제

{posting_info}

[출력 형식 - JSON만 반환]
{{
  "sections": [
    {{"type": "summary",   "title": "자기소개",   "content": "..."}},
    {{"type": "skills",    "title": "기술 스택",  "items": [...], "scores": {{"Python": 75}}}},
    {{"type": "ability",   "title": "능력 분석",  "overall": 67.5, "chart_data": [...]}},
    {{"type": "problems",  "title": "학습 이력",  "total": 120, "highlights": [...]}},
    {{"type": "projects",  "title": "프로젝트",   "items": [...]}}
  ]
}}"""

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={key}"
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
        }

        try:
            resp = requests.post(url, json=body, timeout=30)
            resp.raise_for_status()
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            clean = raw.strip()
            if "```" in clean:
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            return json.loads(clean.strip()), prompt
        except Exception as e:
            return self._generate_rule_based(resume, skill, history), prompt

    def _generate_rule_based(self, resume, skill, history):
        """Gemini 실패 시 규칙 기반 포트폴리오 생성"""
        return {
            "sections": [
                {
                    "type":    "summary",
                    "title":   "자기소개",
                    "content": (
                        f"{resume.get('name')}입니다. "
                        f"총 {history['total_solved']}개 문제를 풀이하였으며 "
                        f"능력 종합 점수 {skill.get('overall_score', 0):.1f}점을 달성했습니다."
                    ),
                },
                {
                    "type":   "skills",
                    "title":  "기술 스택",
                    "items":  resume.get('skills', []),
                    "scores": {
                        k: v for k, v in
                        sorted(skill.get('skill_scores', {}).items(),
                               key=lambda x: -x[1])[:10]
                    },
                },
                {
                    "type":        "ability",
                    "title":       "능력 분석",
                    "overall":     skill.get('overall_score', 0),
                    "strong":      skill.get('strong_skills', []),
                    "weak":        skill.get('weak_skills', []),
                    "by_difficulty": skill.get('by_difficulty', {}),
                },
                {
                    "type":        "problems",
                    "title":       "학습 이력",
                    "total":       history['total_solved'],
                    "job_problems": history['job_problems'],
                    "external":    history['external'],
                    "recent":      history.get('recent_solved', []),
                },
            ]
        }


# ══════════════════════════════════════════════
# 3. RLHF 피드백 수집 & 학습 데이터 추출
# ══════════════════════════════════════════════

class RLHFCollector:
    """
    포트폴리오 피드백을 수집하고 모델 재학습 데이터를 추출합니다.

    사용 예시:
        collector = RLHFCollector()

        # 피드백 저장
        collector.save_feedback(snapshot, user, rating=4,
                                feedback_text="요약이 너무 짧아요",
                                edited_content={"sections": [...]})

        # 학습 배치 추출 (rating >= 3 또는 edited)
        batch = collector.extract_training_batch(min_rating=3)
    """

    def save_feedback(self, snapshot, user, rating,
                      feedback_text=None, edited_content=None):
        """피드백 저장 + RLHF 레이블 자동 계산"""
        from core.models_new import PortfolioFeedback

        rlhf_labels = self._compute_rlhf_labels(
            snapshot, edited_content, rating
        )

        feedback, created = PortfolioFeedback.objects.update_or_create(
            snapshot=snapshot,
            user=user,
            defaults={
                'rating':          rating,
                'feedback_text':   feedback_text,
                'edited_content':  edited_content,
                'rlhf_labels':     rlhf_labels,
                'used_for_training': False,
            }
        )
        return feedback

    def _compute_rlhf_labels(self, snapshot, edited_content, rating):
        """RLHF 레이블 자동 계산"""
        labels = {'overall': rating}

        if edited_content and snapshot.generated_content:
            orig_sections = snapshot.generated_content.get('sections', [])
            edit_sections = edited_content.get('sections', [])

            # edit_distance: 수정된 섹션 비율
            if orig_sections:
                changed = sum(
                    1 for o, e in zip(orig_sections, edit_sections)
                    if o != e
                )
                labels['edit_distance'] = round(changed / len(orig_sections), 2)

            # 선호/거부 섹션
            preferred, rejected = [], []
            for o, e in zip(orig_sections, edit_sections):
                sec_type = o.get('type', '')
                if o == e:
                    preferred.append(sec_type)
                else:
                    rejected.append(sec_type)
            labels['preferred_sections'] = preferred
            labels['rejected_sections']  = rejected

        return labels

    def extract_training_batch(self, min_rating=3, batch_id=None):
        """학습 배치 데이터 추출"""
        from core.models_new import PortfolioFeedback

        if not batch_id:
            batch_id = f"batch_{timezone.now().strftime('%Y%m%d_%H%M%S')}"

        qs = PortfolioFeedback.objects.filter(
            rating__gte=min_rating,
            used_for_training=False
        ).select_related('snapshot', 'user')

        batch = []
        ids   = []
        for fb in qs:
            batch.append({
                'input': {
                    'structured_resume': fb.snapshot.structured_resume,
                    'skill_analysis':    fb.snapshot.skill_analysis,
                    'problem_history':   fb.snapshot.problem_history,
                    'prompt':            fb.snapshot.generation_prompt,
                },
                'output':        fb.snapshot.generated_content,
                'edited_output': fb.edited_content,
                'rlhf_labels':   fb.rlhf_labels,
                'rating':        fb.rating,
            })
            ids.append(fb.id)

        # 학습 사용 표시
        PortfolioFeedback.objects.filter(id__in=ids).update(
            used_for_training=True,
            training_batch_id=batch_id,
        )

        return {'batch_id': batch_id, 'count': len(batch), 'data': batch}