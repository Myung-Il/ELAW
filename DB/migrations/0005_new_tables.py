"""
Migration: 신규 테이블 추가
  - problem_recommendations (문제 추천)
  - skill_gaps              (스킬 갭 분석)
  - portfolio_snapshots     (포트폴리오 버전 관리)
  - portfolio_feedback      (RLHF 피드백)
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_merge_dataset_tables'),
    ]

    operations = [

        # ── 1. skill_gaps (problem_recommendations보다 먼저 생성)
        migrations.CreateModel(
            name='SkillGap',
            fields=[
                ('id',                      models.BigAutoField(auto_created=True, primary_key=True)),
                ('user',                    models.ForeignKey('core.User', on_delete=django.db.models.deletion.CASCADE, related_name='skill_gaps')),
                ('posting',                 models.ForeignKey('core.JobPosting', on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name='skill_gaps')),
                ('skill_name',              models.CharField(max_length=100)),
                ('skill_category',          models.CharField(max_length=30, null=True, blank=True)),
                ('current_level',           models.FloatField()),
                ('required_level',          models.FloatField()),
                ('gap_score',               models.FloatField()),
                ('recommended_problem_ids', models.JSONField(null=True, blank=True)),
                ('calculation_method',      models.CharField(max_length=50, default='rule_based')),
                ('calculated_at',           models.DateTimeField(auto_now_add=True)),
                ('updated_at',              models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'skill_gaps'},
        ),
        migrations.AlterUniqueTogether(name='SkillGap', unique_together={('user', 'posting', 'skill_name')}),
        migrations.AddIndex(model_name='SkillGap', index=models.Index(fields=['user', 'posting'],  name='idx_sg_user_posting')),
        migrations.AddIndex(model_name='SkillGap', index=models.Index(fields=['-gap_score'],       name='idx_sg_gap_score')),
        migrations.AddIndex(model_name='SkillGap', index=models.Index(fields=['skill_category'],   name='idx_sg_category')),

        # ── 2. problem_recommendations
        migrations.CreateModel(
            name='ProblemRecommendation',
            fields=[
                ('id',               models.BigAutoField(auto_created=True, primary_key=True)),
                ('user',             models.ForeignKey('core.User', on_delete=django.db.models.deletion.CASCADE, related_name='problem_recommendations')),
                ('posting',          models.ForeignKey('core.JobPosting', on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name='problem_recommendations')),
                ('skill_gap',        models.ForeignKey('core.SkillGap', on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name='recommendations')),
                ('problem_id',       models.CharField(max_length=100)),
                ('platform',         models.CharField(max_length=20, choices=[('baekjoon','백준'),('programmers','프로그래머스'),('leetcode','LeetCode')])),
                ('title',            models.CharField(max_length=300, null=True, blank=True)),
                ('algo_tags',        models.JSONField(null=True, blank=True)),
                ('difficulty',       models.CharField(max_length=30, null=True, blank=True)),
                ('relevance_score',  models.FloatField()),
                ('reason',           models.TextField(null=True, blank=True)),
                ('model_version',    models.CharField(max_length=50, default='v1.0')),
                ('status',           models.CharField(max_length=10, choices=[('pending','미도전'),('solved','풀이 완료'),('skipped','건너뜀')], default='pending')),
                ('recommended_at',   models.DateTimeField(auto_now_add=True)),
                ('solved_at',        models.DateTimeField(null=True, blank=True)),
            ],
            options={'db_table': 'problem_recommendations'},
        ),
        migrations.AlterUniqueTogether(name='ProblemRecommendation', unique_together={('user', 'platform', 'problem_id', 'posting')}),
        migrations.AddIndex(model_name='ProblemRecommendation', index=models.Index(fields=['user', 'status'],   name='idx_pr_user_status')),
        migrations.AddIndex(model_name='ProblemRecommendation', index=models.Index(fields=['user', 'posting'],  name='idx_pr_user_posting')),
        migrations.AddIndex(model_name='ProblemRecommendation', index=models.Index(fields=['-relevance_score'], name='idx_pr_relevance')),
        migrations.AddIndex(model_name='ProblemRecommendation', index=models.Index(fields=['recommended_at'],   name='idx_pr_recommended_at')),

        # ── 3. portfolio_snapshots
        migrations.CreateModel(
            name='PortfolioSnapshot',
            fields=[
                ('id',                 models.BigAutoField(auto_created=True, primary_key=True)),
                ('portfolio',          models.ForeignKey('core.Portfolio', on_delete=django.db.models.deletion.CASCADE, related_name='snapshots')),
                ('user',               models.ForeignKey('core.User', on_delete=django.db.models.deletion.CASCADE, related_name='portfolio_snapshots')),
                ('posting',            models.ForeignKey('core.JobPosting', on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name='portfolio_snapshots')),
                ('structured_resume',  models.JSONField(null=True, blank=True)),
                ('skill_analysis',     models.JSONField(null=True, blank=True)),
                ('problem_history',    models.JSONField(null=True, blank=True)),
                ('generated_content',  models.JSONField(null=True, blank=True)),
                ('generation_method',  models.CharField(max_length=20, choices=[('gemini','Gemini API'),('model_v1','자체 모델 v1'),('model_v2','자체 모델 v2 (RLHF)'),('manual','수동 편집')], default='gemini')),
                ('generation_prompt',  models.TextField(null=True, blank=True)),
                ('model_version',      models.CharField(max_length=50, null=True, blank=True)),
                ('version',            models.PositiveSmallIntegerField(default=1)),
                ('is_final',           models.BooleanField(default=False)),
                ('quality_score',      models.FloatField(null=True, blank=True)),
                ('generated_at',       models.DateTimeField(auto_now_add=True)),
                ('updated_at',         models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'portfolio_snapshots'},
        ),
        migrations.AddIndex(model_name='PortfolioSnapshot', index=models.Index(fields=['user', 'is_final'],     name='idx_ps_user_final')),
        migrations.AddIndex(model_name='PortfolioSnapshot', index=models.Index(fields=['portfolio', 'version'], name='idx_ps_version')),
        migrations.AddIndex(model_name='PortfolioSnapshot', index=models.Index(fields=['generation_method'],    name='idx_ps_method')),
        migrations.AddIndex(model_name='PortfolioSnapshot', index=models.Index(fields=['generated_at'],         name='idx_ps_generated_at')),

        # ── 4. portfolio_feedback
        migrations.CreateModel(
            name='PortfolioFeedback',
            fields=[
                ('id',                 models.BigAutoField(auto_created=True, primary_key=True)),
                ('snapshot',           models.ForeignKey('core.PortfolioSnapshot', on_delete=django.db.models.deletion.CASCADE, related_name='feedbacks')),
                ('user',               models.ForeignKey('core.User', on_delete=django.db.models.deletion.CASCADE, related_name='portfolio_feedbacks')),
                ('rating',             models.IntegerField(choices=[(1,'매우 불만족'),(2,'불만족'),(3,'보통'),(4,'만족'),(5,'매우 만족')])),
                ('feedback_text',      models.TextField(null=True, blank=True)),
                ('edited_content',     models.JSONField(null=True, blank=True)),
                ('rlhf_labels',        models.JSONField(null=True, blank=True)),
                ('used_for_training',  models.BooleanField(default=False)),
                ('training_batch_id',  models.CharField(max_length=100, null=True, blank=True)),
                ('created_at',         models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'portfolio_feedback'},
        ),
        migrations.AlterUniqueTogether(name='PortfolioFeedback', unique_together={('snapshot', 'user')}),
        migrations.AddIndex(model_name='PortfolioFeedback', index=models.Index(fields=['used_for_training'], name='idx_pf_training')),
        migrations.AddIndex(model_name='PortfolioFeedback', index=models.Index(fields=['rating'],            name='idx_pf_rating')),
        migrations.AddIndex(model_name='PortfolioFeedback', index=models.Index(fields=['created_at'],        name='idx_pf_created_at')),
    ]