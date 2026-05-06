"""
python manage.py load_problems

JobProblems.zip 와 LearningPaths.zip 데이터를 DB에 적재합니다.

사용법:
  python manage.py load_problems --problems_dir /path/to/JobProblems
  python manage.py load_problems --paths_dir   /path/to/LearningPaths
  python manage.py load_problems --problems_dir /path/to/JobProblems \\
                                 --paths_dir   /path/to/LearningPaths \\
                                 --job_role "AI Engineer"    # 특정 직군만
  python manage.py load_problems --reset                     # 전체 초기화 후 재적재
"""

import os
import json
from django.conf import settings
from django.core.management.base import BaseCommand

# BASE_DIR 기준 기본 경로
_BASE_DIR = getattr(settings, 'BASE_DIR', None)
_DEFAULT_PROBLEMS_DIR = os.path.join(str(_BASE_DIR), '..', 'DB', 'JobProblems') if _BASE_DIR else None
_DEFAULT_PATHS_DIR    = os.path.join(str(_BASE_DIR), '..', 'DB', 'LearningPaths') if _BASE_DIR else None


ROLE_FILE_MAP = {
    "AI Engineer":                          "AI_Engineer",
    "AR/VR Engineer":                       "AR_VR_Engineer",
    "AR&VR Engineer":                       "AR&VR_Engineer",
    "Backend Engineer":                     "Backend_Engineer",
    "Big Data Engineer":                    "Big_Data_Engineer",
    "Blockchain Engineer":                  "Blockchain_Engineer",
    "Cloud Infrastructure Engineer":        "Cloud_Infrastructure_Engineer",
    "Computer Vision Engineer":             "Computer_Vision_Engineer",
    "Data Engineer":                        "Data_Engineer",
    "Database Administrator":               "Database_Administrator",
    "Data Scientist":                       "DataScientist",
    "DevOps Engineer":                      "DevOps_Engineer",
    "Embedded Systems Engineer":            "Embedded_Systems_Engineer",
    "Frontend Developer":                   "Frontend_Developer",
    "Full Stack Engineer":                  "Full_Stack_Engineer",
    "Game Developer":                       "Game_Developer",
    "IoT Engineer":                         "IoT_Engineer",
    "Machine Learning Researcher":          "Machine_Learning_Researcher",
    "Mobile App Developer":                 "Mobile_App_Developer",
    "Natural Language Processing Engineer": "Natural_Language_Processing_Engineer",
    "Network Engineer":                     "Network_Engineer",
    "Quality Assurance Engineer (QA)":      "Quality_Assurance_Engineer_QA",
    "Research Scientist":                   "Research_Scientist",
    "Robotics Engineer":                    "Robotics_Engineer",
    "Security Engineer":                    "Security_Engineer",
    "Site Reliability Engineer (SRE)":      "Site_Reliability_Engineer_SRE",
    "Software Architect":                   "Software_Architect",
    "Software Engineer":                    "Software_Engineer",
    "Systems Engineer":                     "Systems_Engineer",
    "Technical Program Manager":            "Technical_Program_Manager",
    "UI/UX Engineer":                       "UI_UX_Engineer",
}


class Command(BaseCommand):
    help = "JobProblems / LearningPaths JSON 파일을 DB에 적재"

    def add_arguments(self, parser):
        parser.add_argument('--problems_dir', type=str, default=_DEFAULT_PROBLEMS_DIR,
                            help='JobProblems JSON 파일이 있는 폴더 경로')
        parser.add_argument('--paths_dir',    type=str, default=_DEFAULT_PATHS_DIR,
                            help='LearningPaths JSON 파일이 있는 폴더 경로')
        parser.add_argument('--job_role',     type=str, default=None,
                            help='특정 직군만 적재 (예: "AI Engineer")')
        parser.add_argument('--reset',        action='store_true',
                            help='기존 데이터 전체 삭제 후 재적재')

    def handle(self, *args, **options):
        from core.models_problems import (
            JobProblem, JobProblemCluster,
            ProblemEdge, LearningPathMeta,
        )

        if options['reset']:
            self.stdout.write("[삭제]  기존 문제 데이터 초기화 중...")
            ProblemEdge.objects.all().delete()
            JobProblemCluster.objects.all().delete()
            LearningPathMeta.objects.all().delete()
            JobProblem.objects.all().delete()
            self.stdout.write("   완료")

        # ── 1. JobProblems 적재
        problems_dir = options['problems_dir']
        if problems_dir and os.path.isdir(problems_dir):
            self._load_problems(problems_dir, options.get('job_role'))
        elif problems_dir:
            self.stderr.write(f"[경고] problems_dir 경로가 존재하지 않습니다: {problems_dir}")

        # ── 2. LearningPaths 적재
        paths_dir = options['paths_dir']
        if paths_dir and os.path.isdir(paths_dir):
            self._load_paths(paths_dir, options.get('job_role'))
        elif paths_dir:
            self.stderr.write(f"[경고] paths_dir 경로가 존재하지 않습니다: {paths_dir}")

        # ── 최종 통계
        from core.models_problems import JobProblem, JobProblemCluster, ProblemEdge
        self.stdout.write(self.style.SUCCESS(
            f"\n[완료] 적재 완료\n"
            f"   JobProblem        : {JobProblem.objects.count()}개\n"
            f"   JobProblemCluster : {JobProblemCluster.objects.count()}개\n"
            f"   ProblemEdge       : {ProblemEdge.objects.count()}개\n"
            f"   LearningPathMeta  : {LearningPathMeta.objects.count()}개"
        ))

    # ──────────────────────────────────────────
    def _load_problems(self, folder, target_role=None):
        """JobProblems/*.json 적재"""
        from core.models_problems import JobProblem

        self.stdout.write(f"\n[폴더] 문제 적재: {folder}")
        files = [f for f in os.listdir(folder) if f.endswith('.json')]
        if target_role:
            prefix = ROLE_FILE_MAP.get(target_role, target_role.replace(' ', '_'))
            files = [f for f in files if f.startswith(prefix)]

        total = 0
        for filename in sorted(files):
            job_role = filename.replace('.json', '').replace('_', ' ')
            path = os.path.join(folder, filename)

            with open(path, 'r', encoding='utf-8') as f:
                problems = json.load(f)

            count = 0
            for p in problems:
                JobProblem.objects.update_or_create(
                    job_role=p.get('job_role', job_role),
                    original_question_id=p.get('question_id') or p.get('this_id'),
                    defaults={
                        'difficulty':       p.get('difficulty', ''),
                        'question_type':    p.get('question_type'),
                        'category':         p.get('category', ''),
                        'subcategory':      p.get('subcategory'),
                        'skills_required':  p.get('skills_required', []),
                        'scenario':         p.get('scenario'),
                        'question':         p.get('question', ''),
                        'choices':          p.get('choices', []),
                        'correct_answer':   p.get('correct_answer', ''),
                        'explanation':      p.get('explanation'),
                    }
                )
                count += 1

            total += count
            self.stdout.write(f"   [{job_role}] {count}문제")

        self.stdout.write(f"   [완료] 총 {total}문제 적재")

    # ──────────────────────────────────────────
    def _load_paths(self, folder, target_role=None):
        """LearningPaths/*_path.json 적재"""
        from core.models_problems import (
            JobProblem, JobProblemCluster,
            ProblemEdge, LearningPathMeta,
        )

        self.stdout.write(f"\n[폴더] 학습 경로 적재: {folder}")
        files = [f for f in os.listdir(folder) if f.endswith('_path.json')]
        if target_role:
            prefix = ROLE_FILE_MAP.get(target_role, target_role.replace(' ', '_'))
            files = [f for f in files if f.startswith(prefix)]

        for filename in sorted(files):
            path = os.path.join(folder, filename)
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            meta = data.get('metadata', {})
            job_role = meta.get('job_role', '').replace('_', ' ')
            # DB에 저장된 실제 job_role로 매핑 (AR&VR, UI&UX 등 특수문자 차이 보정)
            job_role = self._resolve_job_role(job_role)

            # ── 메타 저장
            params = meta.get('parameters', {})
            LearningPathMeta.objects.update_or_create(
                job_role=job_role,
                defaults={
                    'source_file':             meta.get('source_file', filename),
                    'total_problems':          meta.get('total_problems', 0),
                    'cluster_count':           meta.get('cluster_count', 0),
                    'edge_count':              meta.get('edge_count', 0),
                    'isolated_problem_count':  meta.get('isolated_problem_count', 0),
                    'difficulty_distribution': meta.get('difficulty_distribution', {}),
                    'skill_weight':            params.get('skill_weight', 0.6),
                    'scenario_weight':         params.get('scenario_weight', 0.4),
                    'min_combined_score':      params.get('min_combined_score', 0.15),
                    'max_prereqs_per_target':  params.get('max_prereqs_per_target', 3),
                    'same_category_bonus':     params.get('same_category_bonus', 0.1),
                }
            )

            # ── 클러스터 저장
            cluster_count = 0
            for c in data.get('clusters', []):
                params_c = meta.get('parameters', {})
                JobProblemCluster.objects.update_or_create(
                    job_role=job_role,
                    cluster_id=c['cluster_id'],
                    defaults={
                        'category':            c.get('category', ''),
                        'subcategory':         c.get('subcategory'),
                        'size':                c.get('size', 0),
                        'question_ids':        c.get('question_ids', []),
                        'common_skills':       c.get('common_skills', []),
                        'skill_weight':        params_c.get('skill_weight', 0.6),
                        'scenario_weight':     params_c.get('scenario_weight', 0.4),
                        'min_combined_score':  params_c.get('min_combined_score', 0.15),
                        'same_category_bonus': params_c.get('same_category_bonus', 0.1),
                    }
                )
                cluster_count += 1

            # ── 엣지 저장 (dependency_graph.edges 구조 지원)
            # dependency_graph의 edges는 선수관계이므로 is_prerequisite=True 고정
            edge_count = 0
            dep_edges   = data.get('dependency_graph', {}).get('edges', [])
            other_edges = data.get('edges', [])
            # dependency_graph.edges → is_prerequisite=True
            # 최상위 edges → JSON 내 값 사용 (혹은 False)
            edge_sources = [
                (dep_edges,   True),
                (other_edges, False),
            ]
            for raw_edges, default_prereq in edge_sources:
                for e in raw_edges:
                    src_id = e.get('Preceding_ID') or e.get('source')
                    tgt_id = e.get('Target_ID')    or e.get('target')
                    try:
                        src = JobProblem.objects.get(
                            job_role=job_role,
                            original_question_id=src_id
                        )
                        tgt = JobProblem.objects.get(
                            job_role=job_role,
                            original_question_id=tgt_id
                        )
                        ProblemEdge.objects.update_or_create(
                            source_problem=src,
                            target_problem=tgt,
                            defaults={
                                'job_role':            job_role,
                                'combined_score':      e.get('combined_score', 0.0),
                                'skill_overlap':       e.get('skill_overlap'),
                                'scenario_similarity': e.get('scenario_similarity'),
                                'is_prerequisite':     default_prereq,
                            }
                        )
                        edge_count += 1
                    except JobProblem.DoesNotExist:
                        self.stderr.write(
                            f"   [경고]  문제 없음: {job_role} Q{src_id}→Q{tgt_id}"
                        )

            self.stdout.write(
                f"   [{job_role}] "
                f"클러스터:{cluster_count} 엣지:{edge_count}"
            )

    # ──────────────────────────────────────────
    def _resolve_job_role(self, job_role):
        """DB에 저장된 실제 job_role과 매핑 (특수문자 불일치 보정)"""
        from core.models_problems import JobProblem
        import re

        if JobProblem.objects.filter(job_role=job_role).exists():
            return job_role

        # 영문자·숫자만 남겨 비교 (공백·특수문자 모두 제거)
        def normalize(s):
            return re.sub(r'[^a-z0-9]', '', s.lower())

        target = normalize(job_role)
        for actual in JobProblem.objects.values_list('job_role', flat=True).distinct():
            if normalize(actual) == target:
                return actual

        return job_role
