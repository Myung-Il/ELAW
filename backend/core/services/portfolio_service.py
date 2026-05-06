"""
core/services/portfolio_service.py

포트폴리오 생성 서비스.

사용자의 SolveHistory, LearningStats, SkillGap 데이터를 집계하여
Gemini API로 포트폴리오 텍스트를 생성하고 Portfolio/PortfolioSnapshot에 저장한다.
"""

from __future__ import annotations

import uuid


class PortfolioService:
    """Gemini 기반 포트폴리오 자동 생성 서비스."""

    def generate(self, user, posting=None) -> dict:
        """
        1. user의 SolveHistory, LearningStats, SkillGap 집계
        2. Gemini API로 포트폴리오 텍스트 생성
        3. Portfolio 모델 update_or_create
        4. PortfolioSnapshot 저장
        반환: {portfolio_id, snapshot_id, content, ai_generated}
        """
        from core.models import Portfolio
        from core.models_new import PortfolioSnapshot

        # 1. 데이터 수집
        context = self._collect_context(user, posting)

        # 2. Gemini 프롬프트 생성 및 API 호출
        prompt = self._build_prompt(context, posting)
        ai_generated = False
        generated_content = None

        try:
            from core.views_user import call_gemini, parse_json_from_gemini
            raw = call_gemini(user, prompt, 'portfolio')
            if raw:
                parsed = parse_json_from_gemini(raw)
                if parsed:
                    generated_content = parsed
                    ai_generated = True
                else:
                    # JSON 파싱 실패 시 텍스트를 summary로 저장
                    generated_content = {'summary': raw, 'sections': []}
                    ai_generated = True
        except Exception:
            pass

        # Gemini 실패 시 기본 포트폴리오 구성
        if not generated_content:
            generated_content = self._default_content(context)

        # 3. Portfolio update_or_create (사용자당 1개)
        slug = f"{user.id}-{uuid.uuid4().hex[:8]}"
        portfolio, created = Portfolio.objects.update_or_create(
            user=user,
            defaults={
                'title':        f"{user.name}의 개발자 포트폴리오",
                'summary_text': generated_content.get('summary', ''),
                'content_json': generated_content,
                'is_public':    True,
                'public_slug':  slug if created else None,
            },
        )
        # 기존 포트폴리오에 slug가 없으면 설정
        if not portfolio.public_slug:
            portfolio.public_slug = f"{user.id}-{uuid.uuid4().hex[:8]}"
            portfolio.save(update_fields=['public_slug'])

        # 4. PortfolioSnapshot 저장
        last_snapshot = PortfolioSnapshot.objects.filter(
            portfolio=portfolio
        ).order_by('-version').first()
        next_version = (last_snapshot.version + 1) if last_snapshot else 1

        snapshot = PortfolioSnapshot.objects.create(
            portfolio=portfolio,
            user=user,
            posting=posting,
            structured_resume=context.get('resume_data'),
            skill_analysis=context.get('skill_analysis'),
            problem_history=context.get('problem_summary'),
            generated_content=generated_content,
            generation_method=PortfolioSnapshot.Method.GEMINI if ai_generated
                              else PortfolioSnapshot.Method.MODEL_V1,
            generation_prompt=prompt[:10000] if prompt else None,
            model_version='gemini-2.0-flash' if ai_generated else 'rule_based-v1',
            version=next_version,
            is_final=True,
        )

        # 이전 스냅샷 is_final 해제
        PortfolioSnapshot.objects.filter(
            portfolio=portfolio, is_final=True
        ).exclude(pk=snapshot.pk).update(is_final=False)

        return {
            'portfolio_id': portfolio.id,
            'snapshot_id':  snapshot.id,
            'content':      generated_content,
            'ai_generated': ai_generated,
        }

    def _collect_context(self, user, posting=None) -> dict:
        """포트폴리오 생성에 필요한 사용자 데이터 수집."""
        from core.models import SolveHistory, LearningStats
        from core.models_new import SkillGap
        from core.models_problems import JobProblemSolveHistory

        # 외부 풀이 통계
        solve_total  = SolveHistory.objects.filter(user=user).count()
        solve_solved = SolveHistory.objects.filter(user=user, status='solved').count()

        # 자체 문제 풀이 통계
        job_total   = JobProblemSolveHistory.objects.filter(user=user).count()
        job_correct = JobProblemSolveHistory.objects.filter(
            user=user, status='correct'
        ).count()

        # 언어 통계 Top5
        top_langs = list(
            LearningStats.objects.filter(user=user, stat_type='language')
            .order_by('-correct_rate')
            .values('stat_key', 'correct_rate', 'solved_count')[:5]
        )

        # 알고리즘 태그 Top5 (정답률 높은 순)
        top_tags = list(
            LearningStats.objects.filter(user=user, stat_type='algo_tag')
            .order_by('-correct_rate')
            .values('stat_key', 'correct_rate', 'solved_count')[:5]
        )

        # 취약 태그 Top5
        weak_tags = list(
            LearningStats.objects.filter(user=user, stat_type='algo_tag')
            .order_by('correct_rate')
            .values('stat_key', 'correct_rate')[:5]
        )

        # 스킬 갭 (공고가 있으면 해당 공고, 없으면 전체)
        skill_gaps_qs = SkillGap.objects.filter(user=user)
        if posting:
            skill_gaps_qs = skill_gaps_qs.filter(posting=posting)
        skill_gaps = list(skill_gaps_qs.order_by('-gap_score').values(
            'skill_name', 'current_level', 'gap_score'
        )[:10])

        # 자체 문제 직군별 통계
        from django.db.models import Count, Q
        job_role_stats = list(
            JobProblemSolveHistory.objects.filter(user=user)
            .values('problem__job_role')
            .annotate(
                total=Count('id'),
                correct=Count('id', filter=Q(status='correct')),
            )
            .order_by('-total')[:5]
        )

        return {
            'user_name':       user.name,
            'user_email':      user.email,
            'solve_total':     solve_total,
            'solve_solved':    solve_solved,
            'job_total':       job_total,
            'job_correct':     job_correct,
            'top_langs':       top_langs,
            'top_tags':        top_tags,
            'weak_tags':       weak_tags,
            'skill_gaps':      skill_gaps,
            'job_role_stats':  job_role_stats,
            'posting_title':   posting.title if posting else None,
            'posting_company': posting.company.name if posting else None,
            'required_skills': (posting.required_skills or []) if posting else [],
            'resume_data':     {
                'name':     user.name,
                'email':    user.email,
                'languages': [l['stat_key'] for l in top_langs],
                'solve_count': solve_total + job_total,
            },
            'skill_analysis':  {
                'top_langs':  top_langs,
                'top_tags':   top_tags,
                'weak_tags':  weak_tags,
                'skill_gaps': skill_gaps,
            },
            'problem_summary': {
                'external_total':   solve_total,
                'external_solved':  solve_solved,
                'internal_total':   job_total,
                'internal_correct': job_correct,
                'job_role_stats':   job_role_stats,
            },
        }

    def _build_prompt(self, context: dict, posting=None) -> str:
        """Gemini 프롬프트 구성."""
        posting_section = ''
        if posting:
            posting_section = f"""
[지원 공고]
- 회사: {context['posting_company']}
- 직무: {context['posting_title']}
- 필수 스킬: {', '.join(context['required_skills'])}
"""

        langs_str = ', '.join(
            f"{l['stat_key']}({l.get('correct_rate', 0):.0f}%)"
            for l in context['top_langs']
        ) if context['top_langs'] else '없음'

        tags_str = ', '.join(
            f"{t['stat_key']}({t.get('correct_rate', 0):.0f}%)"
            for t in context['top_tags']
        ) if context['top_tags'] else '없음'

        weak_str = ', '.join(
            t['stat_key'] for t in context['weak_tags']
        ) if context['weak_tags'] else '없음'

        gap_str = ', '.join(
            f"{g['skill_name']}(갭:{g['gap_score']:.0f})"
            for g in context['skill_gaps']
        ) if context['skill_gaps'] else '없음'

        return f"""당신은 취업 준비 플랫폼 ELAW의 AI 포트폴리오 생성기입니다.
아래 사용자 정보를 바탕으로 전문적인 개발자 포트폴리오를 JSON으로 생성해주세요.
{posting_section}
[사용자 학습 데이터]
- 이름: {context['user_name']}
- 외부 플랫폼(백준 등) 풀이: {context['solve_total']}문제 (정답: {context['solve_solved']}개)
- ELAW 자체 문제 풀이: {context['job_total']}문제 (정답: {context['job_correct']}개)
- 주요 언어/정답률: {langs_str}
- 강점 알고리즘: {tags_str}
- 취약 분야: {weak_str}
- 스킬 갭: {gap_str}

[요구사항]
- summary: 3~5문장의 자기소개 요약
- sections: [
    {{"type":"skills", "title":"기술 스택", "items":[...]}},
    {{"type":"stats", "title":"학습 통계", "solve_count":N, "correct_rate":N}},
    {{"type":"strengths", "title":"강점", "items":[...]}},
    {{"type":"improvement", "title":"성장 영역", "items":[...]}}
  ]

[JSON만 출력]
{{"summary":"...", "sections":[...]}}"""

    def _default_content(self, context: dict) -> dict:
        """Gemini 실패 시 기본 포트폴리오 내용 생성."""
        total = context['solve_total'] + context['job_total']
        correct = context['solve_solved'] + context['job_correct']
        rate = round(correct / total * 100, 1) if total > 0 else 0

        langs = [l['stat_key'] for l in context['top_langs']]
        tags  = [t['stat_key'] for t in context['top_tags']]

        return {
            'summary': (
                f"{context['user_name']}은(는) 총 {total}개의 문제를 풀이한 개발자입니다. "
                f"주요 언어는 {', '.join(langs[:3]) if langs else '미설정'}이며, "
                f"알고리즘 정답률은 {rate}%입니다."
            ),
            'sections': [
                {
                    'type': 'skills',
                    'title': '기술 스택',
                    'items': langs,
                },
                {
                    'type': 'stats',
                    'title': '학습 통계',
                    'solve_count': total,
                    'correct_rate': rate,
                    'external_solved': context['solve_solved'],
                    'internal_correct': context['job_correct'],
                },
                {
                    'type': 'strengths',
                    'title': '강점 분야',
                    'items': tags[:5],
                },
                {
                    'type': 'improvement',
                    'title': '성장 영역',
                    'items': [t['stat_key'] for t in context['weak_tags']][:5],
                },
            ],
        }
