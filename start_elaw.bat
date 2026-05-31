@echo off
cd /d "%~dp0"
echo.
echo  [ELAW] Starting...
echo  ====================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] %%i

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js 18+
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node %%i

if not exist "backend\.env" (
    echo [INFO] Creating .env...
    copy "backend\.env.example" "backend\.env" >nul
    powershell -Command "$k=(python -c 'import uuid,base64;print(base64.urlsafe_b64encode(uuid.uuid4().bytes*3).decode()[:50])');(Get-Content backend\.env) -replace '^DJANGO_SECRET_KEY=.*',\"DJANGO_SECRET_KEY=$k\" | Set-Content backend\.env"
    echo [OK] .env created
)

if not exist "backend\.venv\Scripts\activate.bat" (
    echo [INFO] Creating virtualenv...
    python -m venv backend\.venv
)
call backend\.venv\Scripts\activate.bat
echo [OK] Virtualenv ready

pip show django >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing packages...
    pip install -r requirements.txt
)
echo [OK] Packages ready

cd backend
python manage.py migrate -v 0 >nul 2>&1
echo [OK] DB migrated

:: Step 1 - load_problems (skip if already loaded)
python manage.py shell -c "from core.models_problems import JobProblem; exit(0 if JobProblem.objects.exists() else 1)" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Loading problem data...
    python manage.py load_problems --problems_dir "%~dp0DB\JobProblems" --paths_dir "%~dp0DB\LearningPaths"
    echo [OK] Problems loaded
) else (
    echo [OK] Problems already loaded. Skipping.
)

:: Step 2 - load_dataset (skip if already loaded)
python manage.py shell -c "from core.models_dataset import DatasetEntry; exit(0 if DatasetEntry.objects.exists() else 1)" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Loading HuggingFace dataset...
    python manage.py load_dataset
    echo [OK] Dataset loaded
) else (
    echo [OK] Dataset already loaded. Skipping.
)

:: Step 3 - seed_all (skip if already seeded)
python manage.py shell -c "from core.models import JobPosting; exit(0 if JobPosting.objects.exists() else 1)" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Seeding initial data...
    python manage.py seed_all
    echo [OK] Seed data loaded
) else (
    echo [OK] Seed data already exists. Skipping.
)

cd ..

if not exist "frontend\node_modules" (
    echo [INFO] Running npm install...
    cd frontend
    call npm install
    cd ..
)
echo [OK] Node packages ready

echo.
echo  ====================================
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   Stop:     Ctrl+C
echo  ====================================
echo.

start "ELAW Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 >nul
start http://localhost:3000

set "PYTHONPATH=%~dp0;%~dp0models\curriculum"
cd backend
python manage.py runserver
pause