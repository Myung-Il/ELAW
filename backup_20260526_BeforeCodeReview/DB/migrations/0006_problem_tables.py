"""
Migration: 문제 데이터셋 & 연관도 테이블 추가
  - job_problems              (6,000개 문제)
  - job_problem_clusters      (클러스터)
  - problem_edges             (선수과목 관계)
  - learning_path_meta        (메타 정보)
  - job_problem_solve_history (사용자 풀이 이력)
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_new_tables'),
    ]

    operations = [

        # ── 1. job_problems
        migrations.CreateModel(
            name='JobProblem',
            fields=[
                ('id',                   models.BigAutoField(auto_created=True, primary_key=True)),
                ('original_question_id', models.PositiveIntegerField()),
                ('job_role',             models.CharField(max_length=100)),
                ('difficulty',           models.CharField(max_length=20,
                                         choices=[('university_level','대학 기초'),
                                                  ('junior_level','신입 수준'),
                                                  ('middle_level','중간 경력'),
                                                  ('senior_level','시니어 수준')])),
                ('question_type',        models.CharField(max_length=20, null=True, blank=True,
                                         choices=[('definition','개념 정의'),
                                                  ('application','응용'),
                                                  ('debugging','디버깅'),
                                                  ('design','설계'),
                                                  ('analysis','분석'),
                                                  ('coding','코딩')])),
                ('category',             models.CharField(max_length=100)),
                ('subcategory',          models.CharField(max_length=100, null=True, blank=True)),
                ('skills_required',      models.JSONField()),
                ('scenario',             models.TextField(null=True, blank=True)),
                ('question',             models.TextField()),
                ('choices',              models.JSONField()),
                ('correct_answer',       models.CharField(max_length=300)),
                ('explanation',          models.TextField(null=True, blank=True)),
                ('total_attempts',       models.PositiveIntegerField(default=0)),
                ('correct_count',        models.PositiveIntegerField(default=0)),
                ('avg_correct_rate',     models.FloatField(null=True, blank=True)),
                ('created_at',           models.DateTimeField(auto_now_add=True)),
                ('updated_at',           models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'job_problems'},
        ),
        migrations.AlterUniqueTogether(
            name='JobProblem',
            unique_together={('job_role', 'original_question_id')},
        ),
        migrations.AddIndex(model_name='JobProblem',
            index=models.Index(fields=['job_role'],                name='idx_jp_job_role')),
        migrations.AddIndex(model_name='JobProblem',
            index=models.Index(fields=['difficulty'],              name='idx_jp_difficulty')),
        migrations.AddIndex(model_name='JobProblem',
            index=models.Index(fields=['category', 'subcategory'], name='idx_jp_category')),
        migrations.AddIndex(model_name='JobProblem',
            index=models.Index(fields=['question_type'],           name='idx_jp_qtype')),

        # ── 2. job_problem_clusters
        migrations.CreateModel(
            name='JobProblemCluster',
            fields=[
                ('id',                  models.BigAutoField(auto_created=True, primary_key=True)),
                ('job_role',            models.CharField(max_length=100)),
                ('cluster_id',          models.CharField(max_length=200)),
                ('category',            models.CharField(max_length=100)),
                ('subcategory',         models.CharField(max_length=100, null=True, blank=True)),
                ('size',                models.PositiveSmallIntegerField()),
                ('question_ids',        models.JSONField()),
                ('common_skills',       models.JSONField(null=True, blank=True)),
                ('skill_weight',        models.FloatField(default=0.6)),
                ('scenario_weight',     models.FloatField(default=0.4)),
                ('min_combined_score',  models.FloatField(default=0.15)),
                ('same_category_bonus', models.FloatField(default=0.1)),
                ('created_at',          models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'job_problem_clusters'},
        ),
        migrations.AlterUniqueTogether(
            name='JobProblemCluster',
            unique_together={('job_role', 'cluster_id')},
        ),
        migrations.AddIndex(model_name='JobProblemCluster',
            index=models.Index(fields=['job_role'], name='idx_jpc_job_role')),
        migrations.AddIndex(model_name='JobProblemCluster',
            index=models.Index(fields=['category'], name='idx_jpc_category')),

        # ── 3. problem_edges
        migrations.CreateModel(
            name='ProblemEdge',
            fields=[
                ('id',                  models.BigAutoField(auto_created=True, primary_key=True)),
                ('job_role',            models.CharField(max_length=100)),
                ('source_problem',      models.ForeignKey('core.JobProblem',
                                        on_delete=django.db.models.deletion.CASCADE,
                                        related_name='outgoing_edges')),
                ('target_problem',      models.ForeignKey('core.JobProblem',
                                        on_delete=django.db.models.deletion.CASCADE,
                                        related_name='incoming_edges')),
                ('combined_score',      models.FloatField()),
                ('skill_overlap',       models.FloatField(null=True, blank=True)),
                ('scenario_similarity', models.FloatField(null=True, blank=True)),
                ('is_prerequisite',     models.BooleanField(default=False)),
                ('created_at',          models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'problem_edges'},
        ),
        migrations.AlterUniqueTogether(
            name='ProblemEdge',
            unique_together={('source_problem', 'target_problem')},
        ),
        migrations.AddIndex(model_name='ProblemEdge',
            index=models.Index(fields=['job_role'],        name='idx_pe_job_role')),
        migrations.AddIndex(model_name='ProblemEdge',
            index=models.Index(fields=['is_prerequisite'], name='idx_pe_prereq')),
        migrations.AddIndex(model_name='ProblemEdge',
            index=models.Index(fields=['-combined_score'], name='idx_pe_score')),
        migrations.AddIndex(model_name='ProblemEdge',
            index=models.Index(fields=['target_problem'],  name='idx_pe_target')),

        # ── 4. learning_path_meta
        migrations.CreateModel(
            name='LearningPathMeta',
            fields=[
                ('id',                      models.BigAutoField(auto_created=True, primary_key=True)),
                ('job_role',                models.CharField(max_length=100, unique=True)),
                ('source_file',             models.CharField(max_length=200)),
                ('total_problems',          models.PositiveSmallIntegerField()),
                ('cluster_count',           models.PositiveSmallIntegerField()),
                ('edge_count',              models.PositiveSmallIntegerField()),
                ('isolated_problem_count',  models.PositiveSmallIntegerField()),
                ('difficulty_distribution', models.JSONField()),
                ('skill_weight',            models.FloatField(default=0.6)),
                ('scenario_weight',         models.FloatField(default=0.4)),
                ('min_combined_score',      models.FloatField(default=0.15)),
                ('max_prereqs_per_target',  models.PositiveSmallIntegerField(default=3)),
                ('same_category_bonus',     models.FloatField(default=0.1)),
                ('loaded_at',               models.DateTimeField(auto_now_add=True)),
                ('updated_at',              models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'learning_path_meta'},
        ),
        migrations.AddIndex(model_name='LearningPathMeta',
            index=models.Index(fields=['job_role'], name='idx_lpm_job_role')),

        # ── 5. job_problem_solve_history
        migrations.CreateModel(
            name='JobProblemSolveHistory',
            fields=[
                ('id',                  models.BigAutoField(auto_created=True, primary_key=True)),
                ('user',                models.ForeignKey('core.User',
                                        on_delete=django.db.models.deletion.CASCADE,
                                        related_name='job_problem_histories')),
                ('problem',             models.ForeignKey('core.JobProblem',
                                        on_delete=django.db.models.deletion.CASCADE,
                                        related_name='solve_histories')),
                ('status',              models.CharField(max_length=10,
                                        choices=[('correct','정답'),
                                                 ('incorrect','오답'),
                                                 ('skipped','건너뜀')])),
                ('selected_answer',     models.CharField(max_length=300, null=True, blank=True)),
                ('time_spent_sec',      models.PositiveSmallIntegerField(null=True, blank=True)),
                ('from_recommendation', models.ForeignKey('core.ProblemRecommendation',
                                        on_delete=django.db.models.deletion.SET_NULL,
                                        null=True, blank=True,
                                        related_name='solve_results')),
                ('solved_at',           models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'job_problem_solve_history'},
        ),
        migrations.AddIndex(model_name='JobProblemSolveHistory',
            index=models.Index(fields=['user', '-solved_at'], name='idx_jpsh_user_time')),
        migrations.AddIndex(model_name='JobProblemSolveHistory',
            index=models.Index(fields=['user', 'status'],    name='idx_jpsh_user_status')),
        migrations.AddIndex(model_name='JobProblemSolveHistory',
            index=models.Index(fields=['problem'],           name='idx_jpsh_problem')),
    ]