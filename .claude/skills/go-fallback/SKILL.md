---
name: go-fallback
description: ELAW 백엔드를 풀백 서버(학교 데이터센터, GPU)로 전환한다. 사용자가 "풀백 서버로 실행해 줘", "풀백으로 전환해 줘", "풀백 서버 켜줘", "주 서버 끄고 풀백으로" 등을 요청하면 사용. 주 서버 복귀는 -To primary.
---

# go-fallback — 풀백 서버 전환 절차

목표: 배포된 Vercel 사이트(`https://elaw-rho.vercel.app`)가 **풀백 서버**
(학교 데이터센터 컨테이너, V100 GPU — AI 포트폴리오 생성 ~10초)를 바라보게 한다.

배경: 풀백 서버는 hot standby로 **이미 상시 가동 중**이며, 자신의 터널 URL을
Supabase `infra_endpoint` 테이블에 자동 게시한다. 전환은 그 URL을 읽어
Vercel `NEXT_PUBLIC_API_URL`을 교체하는 것이 전부다.
구축 내역: `docs/planning/PRD_풀백서버_도커구축.md`, 운영: `docs/OPERATIONS.md`.

## 절차

### 1단계: 전환 실행
```powershell
.\scripts\switch_backend.ps1 -To fallback
```
- 풀백 URL 조회(Supabase) → 헬스체크 → Vercel env 교체 + 재배포 → E2E 검증까지 자동 수행 (~2분).
- 전제: `backend/.env`에 `VERCEL_TOKEN` 존재 (없으면 스크립트가 발급 절차 안내).

### 2단계: 실패 시 대처
- **풀백 URL 조회 실패 / 헬스체크 실패** → 풀백 스택이 죽었을 가능성 (컨테이너 재시작 등):
  ```powershell
  ssh elaw-nas "/volume/elaw/scripts/start_fallback.sh"          # 재기동 (멱등 — 떠 있으면 상태만 출력)
  ssh elaw-nas "/volume/elaw/venv/bin/supervisorctl -c /volume/elaw/scripts/supervisord.conf status"
  ```
  재기동 후 30초 내 새 URL이 게시된다 → 1단계 재시도.
- **ssh 접속 자체가 안 됨** → 학교 서버/네트워크 문제 — 관리자 문의 (외부 주소 220.67.89.246:12278).
- **Vercel 갱신 실패** → `VERCEL_TOKEN` 만료 여부 확인 (vercel.com/account/settings/tokens).

### 3단계: 사용자에게 보고
- 접속 URL: `https://elaw-rho.vercel.app`
- 풀백은 **GPU 추론**이라 AI 포트폴리오 생성이 ~10초로 주 서버(2~4분)보다 빠름을 알린다.
- 알려진 한계: 게시판 첨부파일은 서버별 로컬 저장이라 주 서버에서 올린 첨부는 풀백에서 안 보임.

## 주 서버 복귀

주 서버(로컬 PC)를 먼저 기동(`/go-live` 1단계 = `.\scripts\start_all.ps1`)한 뒤:
```powershell
.\scripts\switch_backend.ps1 -To primary
```

## 주의
- 풀백 DB는 동일 Supabase(6543 Transaction pooler) — 전환해도 데이터는 그대로다.
- 풀백 스택 관리는 supervisord: `supervisorctl ... restart backend|ollama|cloudflared|url_publisher`
- 풀백 코드 업데이트: `ssh elaw-nas "git -C /volume/elaw/app pull"` 후 backend 재시작
  (단, 미커밋 오버레이 파일이 있으면 docs/OPERATIONS.md의 풀백 배포 절차 참고).
