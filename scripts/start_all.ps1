# ELAW 전체 스택 기동 스크립트 — Ollama + Django + Cloudflare 터널
#
# 각 프로세스를 독립 창(Start-Process)으로 띄우므로 이 스크립트(또는 Claude 세션)가
# 끝나도 서비스는 계속 살아있다. 이미 떠 있는 구성요소는 건너뛴다(중복 실행 안전).
#
# 사용법:  .\scripts\start_all.ps1
# 출력:    터널 공개 URL (Vercel NEXT_PUBLIC_API_URL에 설정할 값)
#          → $env:TEMP\elaw_tunnel_url.txt 에도 저장됨

param([int]$Port = 8000)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # 저장소 루트

function Test-PortListening([int]$p) {
    return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

# ── 1. Ollama (:11434) ─────────────────────────────────────
if (Test-PortListening 11434) {
    Write-Host "[1/3] Ollama        : 이미 실행 중" -ForegroundColor Green
} else {
    $ollama = @("D:\Ollama\ollama.exe", "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $ollama) { Write-Host "[1/3] Ollama        : 실행 파일을 찾지 못함 (D:\Ollama)" -ForegroundColor Red; exit 1 }
    Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Minimized
    Write-Host "[1/3] Ollama        : 기동 중..." -ForegroundColor Cyan
}

# ── 2. Django (:$Port) ─────────────────────────────────────
if (Test-PortListening $Port) {
    Write-Host "[2/3] Django :$Port  : 이미 실행 중" -ForegroundColor Green
} else {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$env:PYTHONUTF8='1'; Set-Location '$root\backend'; python manage.py runserver $Port"
    ) -WindowStyle Minimized
    Write-Host "[2/3] Django :$Port  : 기동 중..." -ForegroundColor Cyan
}

# ── 3. Cloudflare 터널 ─────────────────────────────────────
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
    $cf = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "cloudflared.exe" `
        -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $cf) { Write-Host "[3/3] 터널          : cloudflared 미설치 — winget install Cloudflare.cloudflared" -ForegroundColor Red; exit 1 }

$tunnelLog = Join-Path $env:TEMP "elaw_tunnel.log"
$urlFile   = Join-Path $env:TEMP "elaw_tunnel_url.txt"
Remove-Item $tunnelLog, $urlFile -Force -ErrorAction SilentlyContinue

# cloudflared는 URL을 stderr로 출력 → 파일로 받아 파싱
Start-Process -FilePath $cf -ArgumentList "tunnel", "--url", "http://localhost:$Port" `
    -RedirectStandardError $tunnelLog -WindowStyle Hidden
Write-Host "[3/3] 터널          : 기동 중... URL 대기" -ForegroundColor Cyan

# ── 기동 대기 + 검증 ───────────────────────────────────────
# Ollama
foreach ($i in 1..20) { if (Test-PortListening 11434) { break }; Start-Sleep 1 }
# Django 200 응답
$djangoOk = $false
foreach ($i in 1..30) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Port/api/jobs/" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $djangoOk = $true; break }
    } catch {}
    Start-Sleep 1
}
# 터널 URL 추출
$tunnelUrl = $null
foreach ($i in 1..30) {
    if (Test-Path $tunnelLog) {
        $m = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($m) { $tunnelUrl = $m.Matches[0].Value; break }
    }
    Start-Sleep 1
}

# ── 결과 요약 ──────────────────────────────────────────────
Write-Host ""
Write-Host "════════════ 기동 결과 ════════════" -ForegroundColor Yellow
Write-Host ("Ollama  : " + $(if (Test-PortListening 11434) { "OK (:11434)" } else { "실패" }))
Write-Host ("Django  : " + $(if ($djangoOk) { "OK (:$Port, Supabase 연결)" } else { "실패 — backend 창 로그 확인" }))
if ($tunnelUrl) {
    Set-Content -Path $urlFile -Value $tunnelUrl -Encoding ascii
    # 터널 경유 검증 (400이면 ALLOWED_HOSTS 문제)
    $via = "?"
    try { $via = (Invoke-WebRequest -Uri "$tunnelUrl/api/jobs/" -UseBasicParsing -TimeoutSec 15).StatusCode } catch { $via = "실패" }
    Write-Host "터널    : $tunnelUrl (경유 응답: $via)"
    Write-Host ""
    Write-Host "→ 이 URL을 Vercel 환경변수 NEXT_PUBLIC_API_URL 에 설정 후 Redeploy 하세요." -ForegroundColor Yellow
    Write-Host "  (URL 저장 위치: $urlFile)"
} else {
    Write-Host "터널    : URL 추출 실패 — $tunnelLog 확인"
}
