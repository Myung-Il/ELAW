---
name: go-live
description: ELAW 전체 스택을 기동하고 공개 URL로 접속 가능하게 만든다 (Ollama → Django → Cloudflare 터널 → Vercel 환경변수 갱신 → 재배포 → 검증). 사용자가 "URL로 접속할 수 있게 환경설정 해 줘", "서버 띄워줘", "시연 준비해줘", "배포 환경 켜줘", "터널 열어줘" 등을 요청하면 사용.
---

# go-live — ELAW 공개 URL 기동 절차

목표: 배포된 Vercel 사이트(`https://elaw-rho.vercel.app`)가 로컬 백엔드와 연결되어
로그인·퀴즈·AI 포트폴리오까지 전부 동작하는 상태로 만든다.

배경 지식은 루트 `CLAUDE.md`의 Environment Gotchas와 `docs/OPERATIONS.md` 참고.

## 절차

### 1단계: 전체 스택 기동
```powershell
.\scripts\start_all.ps1
```
- Ollama(:11434) / Django(:8000, Supabase 연결) / Cloudflare 터널을 **독립 창**으로 띄운다
  (이미 떠 있는 것은 건너뜀 — 중복 실행 안전, 세션이 끝나도 유지됨).
- 출력 요약에서 세 항목 모두 OK인지 확인. 터널 URL은 `$env:TEMP\elaw_tunnel_url.txt`에도 저장된다.
- 실패 시 대처:
  - Ollama 실패 → `D:\Ollama\ollama.exe` 존재 확인. 모델 누락이면 `D:\Ollama\ollama.exe cp mybot-2b-backup:latest mybot`
  - Django 실패 → 새로 뜬 backend 창의 로그 확인 (보통 Supabase 비밀번호/네트워크 — `backend/.env`의 `DB_PASSWORD`)
  - 터널 경유 응답이 400 → `backend/.env`의 `DJANGO_ALLOWED_HOSTS`에 `.trycloudflare.com` 포함 여부 확인 후 Django 창에서 재시작

### 2단계: Vercel 환경변수 갱신 + 재배포
터널 URL은 실행마다 바뀌므로 매번 필요하다.

**자동 (기본 경로):**
```powershell
.\scripts\update_vercel_env.ps1
```
- `$env:TEMP\elaw_tunnel_url.txt`(1단계가 저장)의 URL로 `NEXT_PUBLIC_API_URL`을 교체하고
  REST API로 프로덕션을 재배포한 뒤 READY까지 대기한다 (~1분).
- 전제: `backend/.env`에 `VERCEL_TOKEN=<액세스 토큰>` 존재. 없으면 스크립트가 발급 절차를 안내한다
  (vercel.com/account/settings/tokens → 생성 → backend/.env에 추가).
- ⚠️ 이 PC는 Windows 계정명이 한글이라 **Vercel CLI(`vercel login` 등)는 크래시함** — CLI를 쓰려 하지 말고 반드시 이 스크립트(REST API) 사용.

**수동 (토큰이 없고 발급도 어려울 때) — 사용자에게 안내:**
1. vercel.com → ELAW 프로젝트 → Settings → Environment Variables
2. `NEXT_PUBLIC_API_URL` = 터널 URL로 수정
3. Deployments → 최신 배포 → ⋯ → Redeploy

### 3단계: E2E 검증
재배포 완료(1~2분) 후:
```powershell
# 배포 사이트 → Vercel 프록시 → 터널 → Django → Supabase 전체 경로
curl.exe -s -o NUL -w "%{http_code}" "https://elaw-rho.vercel.app/api/jobs/"   # 200 기대
```
- 200이면 완료. 로그인까지 확인하려면 시드 계정 `minjun.kim@elaw.kr` / `elaw1234!`로
  `POST /api/accounts/login/` 호출이 access 토큰을 반환하는지 본다.
- 502/504면 재배포가 아직 안 끝났거나 터널 URL 미반영 — 1분 후 재시도.

### 4단계: 사용자에게 보고
- 접속 URL: `https://elaw-rho.vercel.app`
- 터널 URL과 "이 창들(Ollama/Django/터널)을 닫으면 연결이 끊긴다"는 점을 알린다.
- AI 포트폴리오 생성은 비동기(2~4분) — 첫 요청은 모델 로드로 더 걸릴 수 있음.

## 주의
- 모든 Python 명령에 `PYTHONUTF8=1` (start_all.ps1은 자동 처리).
- 포트폴리오 생성을 동기 방식으로 되돌리지 말 것 (프록시 타임아웃 — CLAUDE.md 참고).
- `backend/.env`는 절대 커밋 금지.
- 현재 프로덕션이 **풀백 서버**를 바라보는 상태에서 주 서버로 복귀하려면, 1단계(start_all) 후
  2단계 대신 `.\scripts\switch_backend.ps1 -To primary` 실행 (풀백 전환은 `/go-fallback` 스킬 참고).
