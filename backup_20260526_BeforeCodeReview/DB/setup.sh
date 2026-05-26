#!/bin/bash
# ============================================================
# setup.sh — ELAW DB 전체 초기화 및 데이터 적재 자동화
#
# 사용법:
#   chmod +x DB/setup.sh
#   ./DB/setup.sh
#
# 환경변수 (.env에 설정):
#   DB_NAME     : elaw_db
#   DB_USER     : elaw_user
#   DB_PASSWORD : yourpassword
#   DB_HOST     : localhost
#   DB_PORT     : 3306
#   PROBLEMS_DIR: /path/to/JobProblems   (ZIP 해제 폴더)
#   PATHS_DIR   : /path/to/LearningPaths (ZIP 해제 폴더)
# ============================================================

set -e
cd "$(dirname "$0")/.."   # ELAW 프로젝트 루트로 이동

# ── 환경변수 로드 ────────────────────────────────────────────
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ .env 로드 완료"
else
    echo "❌ .env 파일을 찾을 수 없습니다."
    exit 1
fi

DB_NAME=${DB_NAME:-elaw_db}
DB_USER=${DB_USER:-elaw_user}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
MYSQL_CMD="mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD"

echo ""
echo "============================================================"
echo "  ELAW DB 초기화 시작"
echo "  DB: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "============================================================"

# ── Step 1. MySQL 데이터베이스 생성 ─────────────────────────
echo ""
echo "📦 Step 1. MySQL 데이터베이스 생성..."
$MYSQL_CMD -e "
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '$DB_USER'@'$DB_HOST'
    IDENTIFIED BY '$DB_PASSWORD';

GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'$DB_HOST';
FLUSH PRIVILEGES;
" 2>/dev/null && echo "   ✅ DB & 유저 준비 완료" || echo "   ℹ️  이미 존재하는 DB/유저 (무시)"

# ── Step 2. 가상환경 활성화 ──────────────────────────────────
echo ""
echo "🐍 Step 2. 가상환경 확인..."
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "   ✅ 가상환경 활성화 완료"
elif [ -d ".venv" ]; then
    source .venv/bin/activate
    echo "   ✅ 가상환경 활성화 완료"
else
    echo "   ⚠️  가상환경 없음 — 시스템 Python 사용"
fi

# ── Step 3. 패키지 설치 ─────────────────────────────────────
echo ""
echo "📦 Step 3. 필수 패키지 설치..."
pip install -q mysqlclient datasets 2>&1 | tail -2
echo "   ✅ 패키지 설치 완료"

# ── Step 4. Django Migration ─────────────────────────────────
echo ""
echo "🔧 Step 4. Django Migration 적용..."
python manage.py makemigrations --merge --no-input 2>/dev/null || true
python manage.py migrate
echo "   ✅ Migration 완료"

# ── Step 5. 기초 데이터 적재 ─────────────────────────────────
echo ""
echo "🌱 Step 5. 기초 데이터 적재 (기업/공고/게시글)..."
python manage.py fill_tables
echo "   ✅ 기초 데이터 완료"

# ── Step 6. 문제 데이터셋 적재 ──────────────────────────────
echo ""
echo "📝 Step 6. 문제 데이터셋 적재..."

if [ -z "$PROBLEMS_DIR" ] || [ -z "$PATHS_DIR" ]; then
    echo "   ⚠️  PROBLEMS_DIR 또는 PATHS_DIR 미설정 — 건너뜀"
    echo "   .env에 PROBLEMS_DIR, PATHS_DIR 경로를 추가하세요"
else
    if [ -d "$PROBLEMS_DIR" ] && [ -d "$PATHS_DIR" ]; then
        python manage.py load_problems \
            --problems_dir "$PROBLEMS_DIR" \
            --paths_dir    "$PATHS_DIR"
        echo "   ✅ 문제 데이터셋 완료"
    else
        echo "   ❌ 폴더를 찾을 수 없음: $PROBLEMS_DIR 또는 $PATHS_DIR"
    fi
fi

# ── Step 7. HuggingFace 데이터셋 적재 ───────────────────────
echo ""
echo "🤗 Step 7. HuggingFace 데이터셋 적재..."
echo "   (전체 2,640건 — 시간이 걸릴 수 있습니다)"
python manage.py load_dataset
echo "   ✅ HuggingFace 데이터셋 완료"

# ── 최종 상태 확인 ───────────────────────────────────────────
echo ""
echo "============================================================"
echo "  📊 최종 DB 상태 확인"
echo "============================================================"
python manage.py shell -c "
from core.models import User, JobPosting, Post
from core.models_problems import JobProblem, LearningPathMeta
from core.models_dataset import DatasetEntry
try:
    from core.models_new import SkillGap, PortfolioSnapshot
    sg = SkillGap.objects.count()
    ps = PortfolioSnapshot.objects.count()
except: sg=ps=0

print(f'''
  core_user            : {User.objects.count()}명
  core_jobposting      : {JobPosting.objects.count()}개
  core_post            : {Post.objects.count()}개
  job_problems         : {JobProblem.objects.count()}개
  learning_path_meta   : {LearningPathMeta.objects.count()}개
  dataset_entries      : {DatasetEntry.objects.count()}개
  skill_gaps           : {sg}개
  portfolio_snapshots  : {ps}개
''')
"

echo "============================================================"
echo "  ✅ ELAW DB 초기화 완료!"
echo ""
echo "  다음 단계:"
echo "  1. python manage.py runserver"
echo "  2. 온보딩 웹 UI: onboarding_web.html 열기"
echo "  3. DB 대시보드: db_dashboard.html 열기"
echo "============================================================"