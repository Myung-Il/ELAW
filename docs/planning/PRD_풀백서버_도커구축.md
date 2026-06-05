# PRD — ELAW 풀백(Fallback) 백엔드 서버 구축

| 항목 | 내용 |
|------|------|
| 문서 버전 | v1.1 (2026-06-05) — Phase 0 실사 결과 반영 (docker-compose → 컨테이너 내 직접 설치로 변경) |
| 상태 | Phase 0 완료, Phase 1 진행 대기 |
| 관련 문서 | `CLAUDE.md`, `docs/OPERATIONS.md`, `.claude/skills/go-live/SKILL.md` |

---

## 1. 배경 및 문제 정의

현재 ELAW 백엔드는 **개발용 로컬 PC 1대**에서만 동작한다.

```
Vercel 프론트 → Cloudflare quick tunnel → 로컬 PC (Django :8000 + Ollama :11434) → Supabase Postgres
```

이 구조의 단일 장애점(SPOF):

- 로컬 PC가 꺼지면(퇴근, 정전, 재부팅, 점검) **서비스 전체가 다운**된다.
- 시연·발표 기간에 로컬 PC를 항상 켜 둬야 하는 운영 부담이 있다.
- quick tunnel URL이 재시작마다 바뀌어 매번 Vercel 환경변수 갱신이 필요하다.

## 2. 목표

**학교 데이터센터의 할당 컨테이너에 풀백 백엔드를 상시 가동(hot standby)** 하고,
주 서버(로컬 PC) 장애 시 **수동 전환 스크립트 한 번**으로 트래픽을 풀백으로 돌린다.

추가 요구사항: 사용자가 Claude Code에서 **"풀백 서버로 실행해 줘"** 라고 말하면
전환이 자동 수행되어야 한다 (→ `/go-fallback` 스킬).

### 결정된 사항 (사용자 확정)

| 결정 항목 | 결정 |
|-----------|------|
| 주 서버 | 로컬 PC — 현행 구조 유지 (Ollama 네이티브 + Django runserver + quick tunnel) |
| 풀백 서버 | 학교 데이터센터 **Ubuntu 20.04 컨테이너** (아래 실사 결과 참조) |
| 구축 방식 | **컨테이너 내 직접 설치** + supervisord 프로세스 관리 (자체 docker-compose 불가 — 환경이 이미 컨테이너) |
| Ollama | 풀백에도 설치, **V100 GPU 사용** → mybot 추론 2~4분 → 수 초 예상 |
| 가동 방식 | **상시 가동 (hot standby)** — supervisord autorestart |
| 외부 노출 | Cloudflare **quick tunnel** (도메인 없음 → named tunnel 불가) |
| 전환 방식 | **수동 전환 스크립트** + Claude Code 스킬 트리거 |
| DB | 양쪽 모두 **동일 Supabase Postgres** 공유 — 단, 풀백은 **6543 Transaction pooler** (5432 차단) |

### Phase 0 실사 결과 (2026-06-05 완료)

| 항목 | 결과 |
|------|------|
| 접속 | `ssh elaw-nas` (= `root@220.67.89.246 -p 12278`, 키 인증 등록 완료. 내부망 주소: `172.26.21.246`) |
| 환경 정체 | **이미 도커 컨테이너 내부** (`/.dockerenv` 존재, PID 1 = `run_jupyter.sh`, systemd 없음) — Jupyter 워크스페이스 컨테이너 |
| Docker | ❌ 미설치, docker.sock 없음 → **자체 컨테이너 실행 불가** (DinD 권한 없음) |
| OS / CPU / RAM | Ubuntu 20.04.4, 48코어, RAM 251GB (가용 238GB) |
| GPU | **Tesla V100-PCIE-32GB × 2** (nvidia-smi 정상) |
| 디스크 | `/volume` = NFS 마운트 (25TB 여유) — **작업 디렉터리는 `/volume` 사용** (사용자 지시) |
| 아웃바운드 | GitHub ✅ / Cloudflare ✅ / Supabase 5432 ❌ **차단** / **6543 ✅ 열림** |

## 3. 목표 아키텍처

```
                         Vercel 프론트 (NEXT_PUBLIC_API_URL로 백엔드 선택)
                        ↙ (평시)                       ↘ (장애 시 — 전환 스크립트)
   [주 서버: 로컬 PC]                       [풀백: 학교 데이터센터 컨테이너 (Ubuntu 20.04)]
   quick tunnel A                            supervisord가 4개 프로세스 관리:
   Django :8000 (runserver)                  ├ gunicorn(Django) :9000
   Ollama :11434 (네이티브)                  ├ ollama serve :11434 (mybot, V100 GPU)
        ↓ 5432 (Session pooler)             ├ cloudflared quick tunnel B
        ↘                                    └ url-publisher (터널 URL → Supabase 게시)
              [Supabase Postgres — 공유]    ↙ 6543 (Transaction pooler)
```

### 핵심 설계 결정

1. **풀백 터널 URL 공유 채널 = Supabase**
   quick tunnel은 재시작마다 URL이 바뀐다. 풀백의 `url-publisher` 프로세스가
   cloudflared 로그에서 URL을 파싱해 Supabase의 전용 테이블(`infra_endpoint`)에 upsert한다.
   로컬 PC의 전환 스크립트는 이 테이블에서 풀백 URL을 조회한다 — 별도 통신 채널 불필요.
   ⚠️ 이 테이블은 RLS로 anon 접근 차단 (`apply_supabase_rls.py`에 추가).

2. **프로세스 관리 = supervisord** (pip 설치, root 권한으로 동작, systemd 불필요)
   4개 프로세스 autorestart — 개별 크래시는 자동 복구.
   ⚠️ **알려진 한계**: 데이터센터 관리자가 컨테이너 자체를 재시작하면 수동으로
   `start_fallback.sh` 재실행 필요 (PID 1이 우리 소유가 아님). 운영 문서에 명시.

3. **풀백 DB 연결은 6543 Transaction pooler** (학교망에서 5432 차단)
   Transaction 모드 호환을 위해 Django 설정 분기 필요:
   `DISABLE_SERVER_SIDE_CURSORS = True`, psycopg prepared statement 비활성화
   (`OPTIONS={"prepare_threshold": None}`), `CONN_MAX_AGE = 0`.
   → `settings.py`에 `DB_POOL_MODE=transaction` env 분기 추가 (주 서버는 영향 없음).

4. **Ollama는 GPU(V100) 사용** — 공식 리눅스 설치 스크립트 + NVIDIA 런타임은 컨테이너에 이미 존재.
   mybot은 커스텀 모델이라 pull 불가 → 로컬 PC에서 이전 (Phase 2).

5. **Python 런타임은 uv로 설치** (Ubuntu 20.04 기본 python3.8은 Django 6 미지원)
   — 주 서버와 동일한 Python 버전을 `/volume/elaw` 아래에 격리 설치.

6. **자체 도커 패키징(원안)은 보류** — 추후 관리자에게 Docker 접근을 받으면
   v1.0의 compose 설계로 전환 가능 (부록 참조용으로 이 문서 git 이력에 유지).

## 4. 요구사항

### 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-1 | `start_fallback.sh` 한 번 실행으로 supervisord + 4개 프로세스(backend/ollama/cloudflared/url-publisher)가 기동된다 | P0 |
| FR-2 | 풀백 backend는 Supabase(6543)에 연결되어 모든 API가 주 서버와 동일하게 동작한다 | P0 |
| FR-3 | AI 포트폴리오 생성이 풀백의 Ollama(mybot, GPU)로 정상 동작한다 (비동기 202 + 폴링 패턴 유지) | P0 |
| FR-4 | 풀백 터널 URL이 기동/재시작 시 자동으로 Supabase `infra_endpoint`에 게시된다 | P0 |
| FR-5 | `scripts/switch_backend.ps1 -To fallback`(또는 `-To primary`) 실행으로 Vercel `NEXT_PUBLIC_API_URL` 갱신 + 재배포 + E2E 검증까지 수행된다 | P0 |
| FR-6 | Claude Code에서 "풀백 서버로 실행해 줘" → `/go-fallback` 스킬이 전환을 수행한다 | P0 |
| FR-7 | 개별 프로세스 크래시 시 supervisord가 자동 재기동한다 | P1 |
| FR-8 | 주 서버 복귀(`/go-live` 후 primary 전환)가 가능하다 | P1 |

### 비기능 요구사항 (NFR)

| ID | 요구사항 |
|----|----------|
| NFR-1 | ~~서버 사양~~ → 충족 확인됨 (48코어 / 251GB / 25TB / V100×2) |
| NFR-2 | 전환 소요 시간 ≤ 3분 (Vercel 재배포 시간 포함) |
| NFR-3 | 시크릿(`.env`)은 git에 커밋하지 않고 scp로 배치 — `DJANGO_ALLOWED_HOSTS`에 `.trycloudflare.com` 포함 |
| NFR-4 | 모든 설치물은 `/volume/elaw` 아래에 격리 (NFS 영속 공간 — 컨테이너 이미지 영역은 휘발 가능성 있음) |
| NFR-5 | `infra_endpoint` 테이블은 anon 키로 읽기/쓰기 불가 (RLS) |

### 범위 제외 (Non-goals)

- 자동 헬스체크 기반 failover (수동 전환만)
- named tunnel / 고정 도메인 (도메인 미보유)
- 게시판 첨부파일 동기화 — **알려진 한계**: 첨부파일은 각 서버 로컬 `media/`에 저장되므로
  전환 시 상대 서버에서 업로드한 첨부는 보이지 않음 (DB 데이터는 공유되므로 글 자체는 정상)
- 로드밸런싱·동시 운영 (한 시점에 한 서버만 트래픽 수신)
- 컨테이너 자체 재시작 시 무인 자동 복구 (PID 1 미소유 — 수동 재기동 절차로 갈음)

## 5. 단계별 실행 계획

### ✅ Phase 0 — 사전 준비 (2026-06-05 완료)
- [x] SSH 접근: 키 인증 등록, `~/.ssh/config`에 `elaw-nas` 별칭 (`220.67.89.246:12278`, root)
- [x] 사양 확인: 48코어 / 251GB RAM / 25TB — 기준 크게 상회, **V100×2 GPU 발견**
- [x] 환경 실사: 이미 컨테이너 내부 → 자체 Docker 불가 판정 → **직접 설치 방식으로 전환 결정**
- [x] 아웃바운드: GitHub·Cloudflare OK, Supabase **6543만 가능** → Transaction pooler 사용 결정
- [x] `backend/.env`의 `DJANGO_ALLOWED_HOSTS`에 `.trycloudflare.com` 확인

### ✅ Phase 1 — 런타임 설치 (2026-06-05 완료)
- [x] 디렉터리 구조 생성: `/volume/elaw/{app,runtime,logs,scripts,ollama-models}` (권한 700)
- [x] uv 0.11.19 (`/volume/elaw/runtime/uv`) → **Python 3.14.5** 설치 (주 서버 3.14.4와 동일 마이너) → venv `/volume/elaw/venv`
- [x] **Ollama 0.30.5** 설치 — GitHub 릴리스 `ollama-linux-amd64.tar.zst`(zstd, ollama.com 다운로드 URL은 404) → `/volume/elaw/runtime/ollama`. serve 테스트에서 **CUDA 12로 V100 32GB ×2 인식 확인** (총 VRAM 63.5GiB)
- [x] cloudflared 2026.5.2 (`/volume/elaw/runtime/bin/cloudflared`)
- [x] supervisord 4.3.0 (venv) + 설정 골격 배포 — 리포 `scripts/fallback/{supervisord.conf,start_fallback.sh}` ↔ 풀백 `/volume/elaw/scripts/`

> 작업 메모: 풀백에 zstd 패키지 apt 설치함. PowerShell→ssh로 원격 명령 전달 시 내부 큰따옴표가 소실됨 — 작은따옴표 이중화(`''패턴''`) 또는 Bash 툴 사용.

### ✅ Phase 2 — mybot 모델 이전 (2026-06-05 완료)
- [x] 모델 구조 파악: GGUF 블롭 1개(1.6GB, gemma2:2b 기반) + Modelfile(템플릿·한국어 시스템 프롬프트·PARAMETER 4개)
- [x] 블롭 scp 전송 (SHA256 일치 검증: `7462...1b`) + FROM 경로 수정한 Modelfile → `ollama create mybot` 성공
      ⚠️ 교훈: scp 완료 전 create 실행 시 digest mismatch — 반드시 업로드 완료·해시 검증 후 create
- [x] GPU 추론 실측: **100% GPU(V100), 89.3 tok/s, 워밍업 후 195토큰 ≈ 2.4초** (주 서버 CPU 2~4분 대비 ~10배+)
      — 재생성용 원본 보존: `/volume/elaw/runtime/{mybot.gguf,mybot.Modelfile}`

**완료 기준 충족**: 풀백에서 mybot GPU 추론 성공.

### ✅ Phase 3 — 코드 배포 + Transaction pooler 대응 (2026-06-05 완료)
- [x] `backend/config/settings.py`에 `DB_POOL_MODE=transaction` 분기 추가 (prepare_threshold=None, DISABLE_SERVER_SIDE_CURSORS, CONN_MAX_AGE=0) + `requirements.txt`에 gunicorn 추가 — **로컬 수정, 커밋 대기 중** (풀백엔 scp 오버레이로 반영)
- [x] repo clone (`/volume/elaw/app`, 29ea37e) + 의존성 설치 완료
- [x] 풀백 `.env`: 주 서버 사본에서 `DB_PORT=6543` + `DB_POOL_MODE=transaction` (chmod 600). DB 연결 검증: users 32 / postings 1346
- [x] 스모크 테스트 전체 통과 (`/volume/elaw/scripts/smoke_test.py`, 리포 `scripts/fallback/`):
      공고 목록·로그인·대시보드 200, **포트폴리오 생성 202→done 총 10초** (GPU 추론 8.5초 — 주 서버 2~4분 대비)
- [x] `portfolio_ai.py` Ollama 주소는 `OLLAMA_HOST` env 재정의 가능 확인 (풀백도 127.0.0.1:11434라 수정 불필요)

**완료 기준 충족**: 풀백 단독으로 전체 API 정상 (localhost 검증).
> 작업 메모: `/api/jobs/` 응답은 `{message,count,...,data:[...]}` 구조. apply는 `experience` 필수. 현재 ollama/gunicorn은 nohup 임시 기동 상태 — Phase 4에서 supervisord로 전환 시 먼저 종료할 것.

### ✅ Phase 4 — 터널 + URL 게시 + 상시 가동화 (2026-06-05 완료)
- [x] `infra_endpoint` 테이블 — url_publisher가 시작 시 자체 생성(idempotent) + RLS 활성화 + anon/authenticated REVOKE
      (별도 마이그레이션·RLS 스크립트 수정 불필요 — 정책 0개 = 차단. 검증: RLS on, policies 0)
- [x] `url_publisher.py` 구현 (리포 `scripts/fallback/`) — cloudflared 로그 15초 폴링, URL 변경 시 Supabase(6543, prepare_threshold=None) upsert
- [x] supervisord 4-프로세스 정식 기동 (`start_fallback.sh`) — 전부 RUNNING
- [x] E2E 전부 통과: 외부에서 터널 경유 `/api/jobs/` 200 / gunicorn kill → 7초 자동복구 / 터널 재시작 → 30초 내 새 URL 게시 / 로컬 PC에서 Supabase 경유 풀백 URL 조회 성공

**완료 기준 충족**. 풀백 hot standby 가동 개시 (현재 URL은 infra_endpoint에서 항상 최신 조회 가능).
> 작업 메모: 원격 pkill은 패턴 자기 매칭 방지를 위해 `pkill -f [g]unicorn` 브래킷 트릭 사용. supervisord 기동 전 nohup 임시 프로세스 종료 필수 (포트 충돌 → FATAL).

### ✅ Phase 5 — 전환 스크립트 + Claude Code 스킬 (2026-06-05 완료)

구현 결과:
- `scripts/switch_backend.ps1` (UTF-8 BOM) — URL 결정(풀백: `scripts/fallback/get_fallback_url.py`로 Supabase 조회 / 주: temp 파일) → 헬스체크 → `update_vercel_env.ps1 -TunnelUrl` 재사용 → 프로덕션 E2E
- `.claude/skills/go-fallback/SKILL.md` — "풀백 서버로 실행해 줘" 트리거, 장애 대처(재기동 절차) 포함
- `/go-live` 스킬에 primary 복귀 시나리오 추가
- **실전 검증 완료**: `-To fallback` 실행 → 총 ~1분 만에 전환 성공 (Vercel 빌드 40초), 프로덕션 200

원래 계획(참고):
- [ ] `scripts/switch_backend.ps1` 작성:
      1. `-To fallback` → Supabase에서 풀백 URL 조회, `-To primary` → `$env:TEMP\elaw_tunnel_url.txt`의 주 서버 URL 사용
      2. 대상 URL 헬스체크 (`/api/jobs/` 200) — 실패 시 중단·안내
      3. `update_vercel_env.ps1` 로직 재사용해 `NEXT_PUBLIC_API_URL` 교체 + 재배포 + READY 대기
      4. `https://elaw-rho.vercel.app/api/jobs/` 200으로 최종 검증
      ⚠️ UTF-8 BOM 저장 (한글 포함 .ps1 규칙)
- [ ] `.claude/skills/go-fallback/SKILL.md` 작성 — 트리거: "풀백 서버로 실행해 줘", "풀백으로 전환" 등.
      절차: 풀백 헬스체크 (`ssh elaw-nas`로 supervisord 상태 확인, 죽었으면 `start_fallback.sh` 재기동) → `switch_backend.ps1 -To fallback` → 검증 → 보고
- [ ] `/go-live` 스킬에 주 서버 복귀 시나리오 한 줄 연동 (기동 후 primary 전환 안내)

**완료 기준**: "풀백 서버로 실행해 줘" 한 마디로 ≤ 3분 내 전환 완료.

### ✅ Phase 6 — 리허설 + 문서화 (2026-06-05 완료)
- [x] 왕복 리허설: 풀백 전환(~1분) → 주 서버 기동+primary 복귀(~1분) → 풀백 재전환 — 3회 전환 모두 무결.
      프로덕션 경유 로그인(시드 계정 JWT 발급)까지 검증. **최종 상태: 풀백 운영 중** (사용자 결정)
- [x] `docs/OPERATIONS.md` §10 풀백 운영 절차 추가 (구조/전환/재기동/코드 업데이트/한계) + 트러블슈팅·색인 갱신
- [x] `CLAUDE.md` 현행화 (topology, Environment Gotchas의 /go-fallback, Current Status)

**완료 기준 충족**: 리허설 무결 통과 + 문서 반영. — **프로젝트 전 Phase 완료** 🎉

## 6. 성공 기준 (Acceptance Criteria)

1. 주 서버(로컬 PC)를 완전히 꺼도, 전환 스크립트 실행 후 `https://elaw-rho.vercel.app`에서 로그인·공고 조회·퀴즈·AI 포트폴리오 생성이 모두 동작한다.
2. "풀백 서버로 실행해 줘" 발화 → 추가 질문 없이 전환이 수행되고 결과(성공 URL/검증 코드)가 보고된다.
3. 풀백 프로세스가 개별 크래시해도 supervisord가 자동 복구한다.
4. 주 서버 복귀 전환도 동일 스크립트로 가능하다.
5. 풀백의 AI 포트폴리오 생성이 GPU 추론으로 주 서버보다 빠르거나 같다.

## 7. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 데이터센터 관리자가 컨테이너 재시작 | 풀백 전체 다운 (자동 복구 불가) | `/volume`(NFS)에 모든 자산 보존 → `start_fallback.sh` 재실행만으로 복구. 운영 문서에 절차 명시. 학교 IP가 바뀌지 않는 한 SSH 접근도 유지 |
| Transaction pooler 비호환 쿼리 (서버사이드 커서·prepared stmt·세션 기능) | 풀백에서 특정 API 오류 | Phase 3 설정 분기 + 전체 API 스모크 테스트로 검증. 문제 발견 시 해당 쿼리 수정 |
| quick tunnel 불안정/속도 제한 | 간헐 502 | hot standby라 터널 장기 유지 — url-publisher가 재시작 시 URL 재게시로 흡수 |
| GPU를 다른 사용자/프로세스가 점유 | 추론 지연 | Ollama는 가용 GPU 자동 선택 (V100 2장). 최악의 경우 CPU 폴백 (48코어 — 주 서버보단 빠름) |
| 학교 방화벽 정책 변경 (12278/아웃바운드) | 관리 접근 또는 서비스 불가 | 발견 즉시 관리자 협의. 터널은 아웃바운드 443이라 차단 가능성 낮음 |
| `.env` 시크릿 서버 유출 | 보안 | `/volume/elaw` 권한 700, repo 커밋 금지 |
| 첨부파일 불일치 | 전환 중 일부 첨부 미표시 | 알려진 한계로 문서화 (Non-goal) |

## 8. 오픈 이슈

- [x] ~~Linux 서버 실제 사양·접근 정보~~ → Phase 0 완료 (위 실사 결과)
- [x] ~~외부 노출 방식~~ → quick tunnel 확정
- [ ] mybot 베이스 모델 공개 여부 → 모델 이전 방식 결정 (Phase 2)
- [ ] `portfolio_ai.py`의 Ollama 주소가 env 주입 가능한지 (Phase 3에서 확인 — 풀백도 127.0.0.1:11434라 영향 없을 가능성 높음)
- [ ] 컨테이너 재시작 빈도/정책 (관리자 확인되면 리스크 재평가)
