# ELAW 백엔드 Cloudflare Quick Tunnel 실행 스크립트
#
# 로컬 Django(기본 8000포트)를 공개 URL(https://xxx.trycloudflare.com)로 노출한다.
# 배포된 Vercel 프론트엔드가 이 URL로 API를 프록시한다.
#
# 사용법:
#   1) 백엔드 먼저 실행:  cd backend; python manage.py runserver
#   2) 새 터미널에서:     .\scripts\start_tunnel.ps1
#   3) 출력된 https://xxx.trycloudflare.com URL을
#      Vercel → Settings → Environment Variables → NEXT_PUBLIC_API_URL 에 설정
#      → Deployments에서 Redeploy (환경변수는 재배포해야 반영됨)
#
# 주의: 무료 quick tunnel은 실행할 때마다 URL이 바뀐다.
#       시연 전마다 위 3번 과정을 반복해야 한다.
#       고정 URL이 필요하면 Cloudflare 계정 + 도메인 기반 named tunnel로 업그레이드.

param([int]$Port = 8000)

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "cloudflared가 설치되어 있지 않습니다. 설치:" -ForegroundColor Yellow
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

Write-Host "로컬 백엔드(localhost:$Port)를 Cloudflare Tunnel로 공개합니다..." -ForegroundColor Cyan
Write-Host "아래 출력에서 https://xxx.trycloudflare.com URL을 확인하세요. (Ctrl+C로 종료)`n" -ForegroundColor Cyan

cloudflared tunnel --url "http://localhost:$Port"
