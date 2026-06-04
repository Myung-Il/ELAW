# Vercel 환경변수(NEXT_PUBLIC_API_URL) 갱신 + 프로덕션 재배포 — REST API 방식
#
# 배경: 이 PC는 Windows 계정명이 한글이라 Vercel CLI가 크래시함(UA 헤더 버그).
#       → 액세스 토큰 + REST API로 동일 작업을 수행한다.
#
# 사전 준비 (1회): https://vercel.com/account/settings/tokens 에서 토큰 생성 후
#                  backend/.env 에 VERCEL_TOKEN=<토큰> 추가 (절대 커밋 금지 — .env는 gitignore됨)
#
# 사용법:
#   .\scripts\update_vercel_env.ps1                      # $env:TEMP\elaw_tunnel_url.txt 의 URL 사용
#   .\scripts\update_vercel_env.ps1 -TunnelUrl https://xxx.trycloudflare.com

param(
    [string]$TunnelUrl = "",
    [string]$Project = "elaw"      # Vercel 프로젝트 이름 (도메인 elaw-rho.vercel.app)
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# ── 입력값 수집 ────────────────────────────────────────────
if (-not $TunnelUrl) {
    $urlFile = Join-Path $env:TEMP "elaw_tunnel_url.txt"
    if (Test-Path $urlFile) { $TunnelUrl = (Get-Content $urlFile -Raw).Trim() }
}
if (-not $TunnelUrl) { Write-Host "터널 URL이 없습니다. 먼저 .\scripts\start_all.ps1 을 실행하거나 -TunnelUrl 로 지정하세요." -ForegroundColor Red; exit 1 }
$TunnelUrl = $TunnelUrl.TrimEnd("/")

$envLine = Select-String -Path (Join-Path $root "backend\.env") -Pattern "^VERCEL_TOKEN=(.+)$" | Select-Object -First 1
if (-not $envLine) {
    Write-Host "backend/.env 에 VERCEL_TOKEN 이 없습니다." -ForegroundColor Red
    Write-Host "  1) https://vercel.com/account/settings/tokens 에서 토큰 생성 (Scope: Full Account 또는 해당 프로젝트)"
    Write-Host "  2) backend/.env 에 한 줄 추가:  VERCEL_TOKEN=<토큰>"
    exit 1
}
$token = $envLine.Matches[0].Groups[1].Value.Trim()
$h = @{ Authorization = "Bearer $token" }
$api = "https://api.vercel.com"

# ── 프로젝트 확인 (팀 소속이면 teamId 쿼리 자동 추가) ─────
$teamQ = ""
try {
    $proj = Invoke-RestMethod -Uri "$api/v9/projects/$Project" -Headers $h
} catch {
    # 개인 스코프에 없으면 소속 팀들을 뒤져본다
    $teams = (Invoke-RestMethod -Uri "$api/v2/teams" -Headers $h).teams
    foreach ($t in $teams) {
        try {
            $proj = Invoke-RestMethod -Uri "$api/v9/projects/$Project`?teamId=$($t.id)" -Headers $h
            $teamQ = "?teamId=$($t.id)"; break
        } catch {}
    }
    if (-not $proj) { Write-Host "프로젝트 '$Project' 를 찾지 못했습니다 (토큰 권한/프로젝트명 확인)." -ForegroundColor Red; exit 1 }
}
$amp = if ($teamQ) { "&" } else { "?" }
Write-Host "프로젝트: $($proj.name) (id: $($proj.id))"

# ── 1. NEXT_PUBLIC_API_URL 교체 ───────────────────────────
$envs = (Invoke-RestMethod -Uri "$api/v9/projects/$($proj.id)/env$teamQ" -Headers $h).envs
foreach ($e in ($envs | Where-Object { $_.key -eq "NEXT_PUBLIC_API_URL" })) {
    Invoke-RestMethod -Method Delete -Uri "$api/v9/projects/$($proj.id)/env/$($e.id)$teamQ" -Headers $h | Out-Null
}
$body = @{ key = "NEXT_PUBLIC_API_URL"; value = $TunnelUrl; type = "plain"; target = @("production", "preview") } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/v10/projects/$($proj.id)/env$teamQ" -Headers $h -Body $body -ContentType "application/json" | Out-Null
Write-Host "환경변수 갱신: NEXT_PUBLIC_API_URL = $TunnelUrl" -ForegroundColor Green

# ── 2. 최신 프로덕션 배포를 재배포 ────────────────────────
$latest = (Invoke-RestMethod -Uri "$api/v6/deployments$teamQ${amp}projectId=$($proj.id)&target=production&limit=1" -Headers $h).deployments | Select-Object -First 1
if (-not $latest) { Write-Host "기존 프로덕션 배포가 없습니다 — git push로 첫 배포를 만드세요." -ForegroundColor Red; exit 1 }
$reBody = @{ name = $proj.name; deploymentId = $latest.uid; target = "production" } | ConvertTo-Json
$newDep = Invoke-RestMethod -Method Post -Uri "$api/v13/deployments$teamQ${amp}forceNew=1" -Headers $h -Body $reBody -ContentType "application/json"
Write-Host "재배포 시작: $($newDep.id)" -ForegroundColor Cyan

# ── 3. 빌드 완료 대기 (최대 5분) ──────────────────────────
foreach ($i in 1..30) {
    Start-Sleep 10
    $st = (Invoke-RestMethod -Uri "$api/v13/deployments/$($newDep.id)$teamQ" -Headers $h).readyState
    Write-Host "  [$($i*10)s] $st"
    if ($st -eq "READY") {
        Write-Host ""
        Write-Host "완료! https://$($proj.name)-rho.vercel.app (또는 프로젝트 도메인) 에서 새 터널 URL이 반영되었습니다." -ForegroundColor Green
        exit 0
    }
    if ($st -in @("ERROR", "CANCELED")) { Write-Host "재배포 실패: $st — Vercel 대시보드 확인" -ForegroundColor Red; exit 1 }
}
Write-Host "5분 내 READY 미도달 — Vercel 대시보드에서 진행 상황 확인" -ForegroundColor Yellow
