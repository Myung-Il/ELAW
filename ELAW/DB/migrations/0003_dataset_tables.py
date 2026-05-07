"""
Migration 0003: 데이터셋 레이어 테이블 5개 추가
  - dataset_entries
  - dataset_resumes
  - dataset_job_descriptions
  - dataset_match_scores
  - dataset_load_history

의존: 0002_user_is_staff_alter_user_is_superuser (기존 마이그레이션)
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_user_is_staff_alter_user_is_superuser'),
    ]

    operations = [

        # ── 1. dataset_entries ─────────────────────────────────
        migrations.CreateModel(
            name='DatasetEntry',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True)),
                ('dataset_id',    models.UUIDField(unique=True,
                                  help_text='curr_type_id (HuggingFace UUID)')),
                ('curr_type_str', models.CharField(max_length=200,
                                  help_text='"Software Engineer_Junior_Google" 형태')),
                ('job_title',     models.CharField(max_length=100, default='Software Engineer')),
                ('career_level',  models.CharField(max_length=10, default='unknown',
                                  choices=[('junior','신입/주니어'),('mid','중간경력'),
                                           ('senior','시니어'),('unknown','미분류')])),
                ('company_name',  models.CharField(max_length=100)),
                ('resume_raw',    models.TextField()),
                ('jd_raw',        models.TextField()),
                ('is_parsed',     models.BooleanField(default=False)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'dataset_entries'},
        ),
        migrations.AddIndex(model_name='DatasetEntry',
            index=models.Index(fields=['company_name'], name='idx_ds_company')),
        migrations.AddIndex(model_name='DatasetEntry',
            index=models.Index(fields=['career_level'], name='idx_ds_level')),
        migrations.AddIndex(model_name='DatasetEntry',
            index=models.Index(fields=['job_title'],    name='idx_ds_job')),
        migrations.AddIndex(model_name='DatasetEntry',
            index=models.Index(fields=['is_parsed'],    name='idx_ds_parsed')),

        # ── 2. dataset_resumes ─────────────────────────────────
        migrations.CreateModel(
            name='DatasetResume',
            fields=[
                ('id',              models.BigAutoField(auto_created=True, primary_key=True)),
                ('entry',           models.OneToOneField(
                                        to='core.DatasetEntry',
                                        on_delete=django.db.models.deletion.CASCADE,
                                        related_name='parsed_resume')),
                ('candidate_name',  models.CharField(max_length=100, null=True, blank=True)),
                ('email',           models.CharField(max_length=200, null=True, blank=True)),
                ('phone',           models.CharField(max_length=50,  null=True, blank=True)),
                ('linkedin_url',    models.URLField(max_length=300,  null=True, blank=True)),
                ('github_url',      models.URLField(max_length=300,  null=True, blank=True)),
                ('profile_summary', models.TextField(null=True, blank=True)),
                ('skills_json',     models.JSONField(null=True, blank=True)),
                ('experience_json', models.JSONField(null=True, blank=True)),
                ('education_json',  models.JSONField(null=True, blank=True)),
                ('projects_json',   models.JSONField(null=True, blank=True)),
                ('certifications',  models.JSONField(null=True, blank=True)),
                ('skill_tags',      models.JSONField(null=True, blank=True)),
                ('parsed_at',       models.DateTimeField(auto_now_add=True)),
                ('updated_at',      models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'dataset_resumes'},
        ),
        migrations.AddIndex(model_name='DatasetResume',
            index=models.Index(fields=['candidate_name'], name='idx_dsresume_name')),

        # ── 3. dataset_job_descriptions ────────────────────────
        migrations.CreateModel(
            name='DatasetJobDescription',
            fields=[
                ('id',                    models.BigAutoField(auto_created=True, primary_key=True)),
                ('entry',                 models.OneToOneField(
                                              to='core.DatasetEntry',
                                              on_delete=django.db.models.deletion.CASCADE,
                                              related_name='parsed_jd')),
                ('job_posting',           models.ForeignKey(
                                              to='core.JobPosting',
                                              on_delete=django.db.models.deletion.SET_NULL,
                                              null=True, blank=True,
                                              related_name='dataset_jds')),
                ('company_name',          models.CharField(max_length=100)),
                ('job_title',             models.CharField(max_length=200)),
                ('location',              models.CharField(max_length=200, null=True, blank=True)),
                ('employment_type',       models.CharField(max_length=50,  null=True, blank=True)),
                ('department',            models.CharField(max_length=100, null=True, blank=True)),
                ('responsibilities',      models.JSONField(null=True, blank=True)),
                ('qualifications',        models.JSONField(null=True, blank=True)),
                ('benefits',              models.JSONField(null=True, blank=True)),
                ('required_skill_tags',   models.JSONField(null=True, blank=True)),
                ('preferred_skill_tags',  models.JSONField(null=True, blank=True)),
                ('parsed_at',             models.DateTimeField(auto_now_add=True)),
                ('updated_at',            models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'dataset_job_descriptions'},
        ),
        migrations.AddIndex(model_name='DatasetJobDescription',
            index=models.Index(fields=['company_name'], name='idx_dsjd_company')),
        migrations.AddIndex(model_name='DatasetJobDescription',
            index=models.Index(fields=['job_title'],    name='idx_dsjd_title')),

        # ── 4. dataset_match_scores ────────────────────────────
        migrations.CreateModel(
            name='DatasetMatchScore',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True)),
                ('resume',       models.ForeignKey(
                                     to='core.DatasetResume',
                                     on_delete=django.db.models.deletion.CASCADE,
                                     related_name='match_scores')),
                ('jd',           models.ForeignKey(
                                     to='core.DatasetJobDescription',
                                     on_delete=django.db.models.deletion.CASCADE,
                                     related_name='match_scores')),
                ('is_positive',  models.BooleanField()),
                ('rule_score',   models.FloatField(null=True, blank=True)),
                ('ai_score',     models.FloatField(null=True, blank=True)),
                ('final_score',  models.FloatField(null=True, blank=True)),
                ('score_detail', models.JSONField(null=True, blank=True)),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'dataset_match_scores'},
        ),
        migrations.AlterUniqueTogether(
            name='DatasetMatchScore',
            unique_together={('resume', 'jd')},
        ),
        migrations.AddIndex(model_name='DatasetMatchScore',
            index=models.Index(fields=['is_positive'], name='idx_dsms_positive')),
        migrations.AddIndex(model_name='DatasetMatchScore',
            index=models.Index(fields=['final_score'], name='idx_dsms_score')),

        # ── 5. dataset_load_history ────────────────────────────
        migrations.CreateModel(
            name='DatasetLoadHistory',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True)),
                ('dataset_name',  models.CharField(max_length=200,
                                  default='recuse/synthetic_resume_jd_raw_dataset')),
                ('dataset_split', models.CharField(max_length=50, default='train')),
                ('total_rows',    models.PositiveIntegerField(default=0)),
                ('loaded_rows',   models.PositiveIntegerField(default=0)),
                ('failed_rows',   models.PositiveIntegerField(default=0)),
                ('status',        models.CharField(max_length=10, default='running',
                                  choices=[('running','실행 중'),
                                           ('success','완료'),
                                           ('failed','실패')])),
                ('error_message', models.TextField(null=True, blank=True)),
                ('started_at',    models.DateTimeField(auto_now_add=True)),
                ('finished_at',   models.DateTimeField(null=True, blank=True)),
            ],
            options={'db_table': 'dataset_load_history'},
        ),
        migrations.AddIndex(model_name='DatasetLoadHistory',
            index=models.Index(fields=['-started_at'], name='idx_dlh_started')),
    ]