# ELAW 백엔드 전환 스크립트 — 주 서버(로컬 PC) ↔ 풀백 서버(학교 데이터센터)
#
# Vercel 프론트의 NEXT_PUBLIC_API_URL을 대상 서버의 터널 URL로 교체하고 재배포한다.
#   - fallback: Supabase infra_endpoint에서 풀백 URL 자동 조회 (url_publisher가 상시 게시)
#   - primary : $env:TEMP\elaw_tunnel_url.txt (start_all.ps1이 저장한 주 서버 터널 URL)
#
# 사용법:
#   .\scripts\switch_backend.ps1 -To fallback    # 풀백으로 전환
#   .\scripts\switch_backend.ps1 -To primary     # 주 서버로 복귀
#
# 관련: docs/OPERATIONS.md, .claude/skills/go-fallback/

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("fallback", "primary")]
    [string]$To
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$prodUrl = "https://elaw-rho.vercel.app"

# ── 1. 대상 서버 URL 결정 ─────────────────────────────────
if ($To -eq "fallback") {
    Write-Host "[1/4] Supabase에서 풀백 서버 URL 조회 중..." -ForegroundColor Cyan
    $env:PYTHONUTF8 = "1"
    $targetUrl = (python (Join-Path $root "scripts\fallback\get_fallback_url.py")).Trim()
    if (-not $targetUrl -or $LASTEXITCODE -ne 0) {
        Write-Host "풀백 URL 조회 실패 — 풀백 서버(supervisord) 가동 여부를 확인하세요." -ForegroundColor Red
        Write-Host "  ssh elaw-nas '/volume/elaw/scripts/start_fallback.sh'"
        exit 1
    }
}
else {
    Write-Host "[1/4] 주 서버 터널 URL 확인 중..." -ForegroundColor Cyan
    $urlFile = Join-Path $env:TEMP "elaw_tunnel_url.txt"
    if (-not (Test-Path $urlFile)) {
        Write-Host "주 서버 터널 URL이 없습니다 — 먼저 .\scripts\start_all.ps1 로 주 서버를 기동하세요." -ForegroundColor Red
        exit 1
    }
    $targetUrl = (Get-Content $urlFile -Raw).Trim()
}
$targetUrl = $targetUrl.TrimEnd("/")
Write-Host "  대상($To): $targetUrl"

# ── 2. 대상 서버 헬스체크 ─────────────────────────────────
Write-Host "[2/4] 대상 서버 헬스체크..." -ForegroundColor Cyan
$code = curl.exe -s -o NUL -w "%{http_code}" --max-time 20 "$targetUrl/api/jobs/"
if ($code -ne "200") {
    Write-Host "헬스체크 실패 (HTTP $code) — 전환 중단. 대상 서버 상태를 확인하세요." -ForegroundColor Red
    if ($To -eq "fallback") { Write-Host "  ssh elaw-nas '/volume/elaw/venv/bin/supervisorctl -c /volume/elaw/scripts/supervisord.conf status'" }
    exit 1
}
Write-Host "  OK (200)"

# ── 3. Vercel 환경변수 교체 + 재배포 ──────────────────────
Write-Host "[3/4] Vercel NEXT_PUBLIC_API_URL 교체 + 재배포..." -ForegroundColor Cyan
& (Join-Path $root "scripts\update_vercel_env.ps1") -TunnelUrl $targetUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vercel 갱신 실패 — update_vercel_env.ps1 출력을 확인하세요." -ForegroundColor Red
    exit 1
}

# ── 4. 프로덕션 E2E 최종 검증 ─────────────────────────────
Write-Host "[4/4] 프로덕션 E2E 검증..." -ForegroundColor Cyan
$final = curl.exe -s -o NUL -w "%{http_code}" --max-time 30 "$prodUrl/api/jobs/"
if ($final -eq "200") {
    Write-Host ""
    Write-Host "전환 완료! $prodUrl 이(가) $To 서버($targetUrl)를 바라봅니다." -ForegroundColor Green
}
else {
    Write-Host "최종 검증 HTTP $final — 재배포 전파 지연일 수 있음. 1분 후 다시 확인:" -ForegroundColor Yellow
    Write-Host "  curl.exe -s -o NUL -w `"%{http_code}`" $prodUrl/api/jobs/"
}
