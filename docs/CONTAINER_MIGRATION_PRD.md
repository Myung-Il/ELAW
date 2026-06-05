# PRD: ELAW 인프라 통합 이전 — 클라우드(Vercel + Supabase) → NAS 도커 컨테이너 단독 운영

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 (Phase 0 조사 반영) |
| 작성일 | 2026-06-06 |
| 대상 환경 | NAS 컨테이너 `c095ed446368` (220.67.89.246:12278), 작업 디렉토리 `/volume/ELAW` |
| 관련 문서 | `/volume/ELAW/docs/OPERATIONS.md`, `/volume/ELAW/CLAUDE.md` |

---

## 1. 현재 아키텍처 (Phase 0 조사 결과 — 확정)

```
[GitHub push: main] ──→ Vercel 자동 배포 (elaw-rho.vercel.app, Next.js 16)
                            │ rewrites: /api/* → NEXT_PUBLIC_API_URL
                            ▼
            Cloudflare Quick Tunnel (실행마다 URL 변경)
                            │
              ┌─────────────┴──────────────┐
              ▼ (주 서버)                   ▼ (풀백 서버 — 현재 운영 중)
   로컬 PC: Django :8000              NAS 컨테이너 /volume/elaw
   + Ollama(mybot)                    supervisord: ollama → gunicorn :9000
              │                        → cloudflared → url_publisher
              └─────────────┬──────────────┘
                            ▼ psycopg (pooler 5432/6543)
              Supabase Postgres (wqafbfduiuulsivliddy, 서울)
                            ▲
   랜딩 페이지 ── supabase-js (anon key, RLS 읽기전용) ──┘
```

### 핵심 사실 (이전 난이도를 결정하는 것들)

| 항목 | 확인 결과 | 이전에 미치는 영향 |
|---|---|---|
| 백엔드 | **Django + DRF + simplejwt** (자체 구현 완료) | API 재구현 불필요 — DB만 교체 |
| 인증 | **Django 자체 JWT** (Supabase Auth 아님) | 사용자 계정 이전 문제 없음 ✅ |
| Supabase 역할 | ① Django의 운영 PG ② 랜딩페이지 supabase-js 직접 조회 4테이블 ③ `infra_endpoint` 터널 URL 게시 | ①은 로컬 PG로, ②는 Django API로 대체, ③은 고정 포트화로 소멸 |
| supabase-js 사용처 | `frontend/lib/supabase.ts` + `app/page.tsx` 단 2개 파일 | 교체 범위 작음 ✅ |
| RLS | PostgREST 노출 방어용 | 로컬 PG는 PostgREST 없음 → 불필요 |
| AI (Ollama) | 풀백에 GPU 추론 이미 구축 (`/volume/elaw/runtime/ollama`, 모델 보유) | 재사용 가능 ✅ |

### 컨테이너 환경

| 항목 | 값 |
|---|---|
| OS / 권한 | Ubuntu 20.04 (focal), root, **apt 사용 가능**, docker 없음 |
| 자원 | 48 vCPU, 251GB RAM, **Tesla V100 32GB × 2** |
| 스토리지 | `/volume` = NFS 마운트 (192.168.1.1:/volume1/...), 25TB 여유 |
| 런타임 | Python 3.13 (`/volume/ELAW/.venv`, miniconda 기반), Node v20.20.2, supervisord(시스템 + 풀백용 2개) |
| Git | `https://github.com/Myung-Il/ELAW.git` |
| 기존 가동 | `/volume/elaw` 풀백 스택(운영 중 — 전환 완료까지 유지), `/volume/ELAW` runserver :9001 (작업용) |

### ⚠️ 블로커: 외부 포트

외부에서 포트 도달성 테스트 결과 — **12278(SSH) 외 전부 차단** (9000, 9001, 3000, 8888, 80, 443 모두 불통).

> **결정 (2026-06-06 최종, 사용자)**: **외부망 포트 직접 노출 + 승인된 IP만 허용** (nginx allowlist — `scripts/nginx_allowlist.conf`, 노트북 110.13.213.214·학교 내부망 등록, 팀원 IP는 한 줄씩 추가).
>
> - 외부에서 현재 12278(SSH)만 개방 → **NAS 관리자에게 컨테이너 80 포트 매핑 요청 필요** (사용자 액션, 태스크 #7)
> - 매핑 전 임시 접속: SSH 터널 `ssh -L 8080:127.0.0.1:80 -p 12278 root@220.67.89.246` 후 `http://localhost:8080`
> - 주의: 호스트/공유기 NAT가 출발지 IP를 SNAT하면 allowlist가 무력화될 수 있음 — 매핑 후 외부 접속 테스트에서 확인 (Phase 5)

## 2. 목표 아키텍처

```
[사용자] ──→ 220.67.89.246:<매핑 포트>  (또는 과도기: Cloudflare Tunnel)
                  │
   ┌──────────────┴────────────────────────────────────┐
   │  NAS 컨테이너  /volume/ELAW                         │
   │                                                    │
   │  nginx :80 ──┬── /        → Next.js :3000          │
   │              └── /api, /admin, /media → Django :9000│
   │                                                    │
   │  Django(gunicorn) :9000 ──→ PostgreSQL :5432 (로컬) │
   │       └──→ Ollama :11434 (mybot, V100 GPU)         │
   │                                                    │
   │  supervisord가 전 프로세스 관리 (자동 재시작)          │
   └────────────────────────────────────────────────────┘
```

- Vercel, Supabase, (최종적으로) Cloudflare 의존 제거
- 단일 오리진이 되므로 Vercel rewrites / `NEXT_PUBLIC_API_URL` 외부 의존 소멸
- `url_publisher` / `infra_endpoint` / `switch_backend.ps1` 체계 폐기 (고정 주소화)

## 3. 목표 / 비목표

**목표**
1. 프론트·백엔드·DB·AI 전부 컨테이너 내부 실행, 단일 포트 노출
2. Supabase → 로컬 PostgreSQL 데이터 무손실 이전 (행 수 대조 검증)
3. 랜딩페이지 supabase-js 직접 조회 → Django API로 대체
4. 컨테이너 재시작 시 전 서비스 자동 복구 + 일일 DB 백업
5. 전환 완료까지 기존 체계(로컬 PC 주 서버 + `/volume/elaw` 풀백) 무중단 유지

**비목표**
- 기능 추가/변경 (기존 기능 동일 동작이 기준)
- HTTPS (포트 직접 노출 방침; named tunnel 채택 시에는 자동 해결)
- `/volume/elaw` 풀백 스택 개편 (전환 완료 후 정리만)

## 4. 단계별 실행 계획

### ✅ Phase 0 — 환경 조사 (완료, 2026-06-06)
결과는 §1. 잔여 액션: **NAS 관리자에게 포트 매핑 요청** (사용자).

### ✅ Phase 1 — PostgreSQL 구축 + 데이터 이전 (완료, 2026-06-06)
- [x] PostgreSQL **16.9** 설치 (PGDG focal은 apt-archive로 폴백 — `scripts/provision_postgres.sh`)
- [x] 데이터 디렉토리 `/volume/ELAW/data/postgres` (NFS) — initdb·기동 정상, **UTF8/C.UTF-8** (최초 SQL_ASCII로 생성되어 재생성함)
- [x] `elaw` DB/롤 생성, 127.0.0.1 바인딩 (비밀번호는 `backend/.env`에만 기록)
- [x] `settings.py` sslmode 환경변수화 (`DB_SSLMODE=disable`, 기본값 require 유지)
- [x] 이전: 풀백 배포 경유 `dumpdata`(-e contenttypes -e auth.permission -e admin.logentry -e sessions, 28MB) → `migrate` → `fast_loaddata.py` (36,623 객체, 4.2s)
- [x] `infra_endpoint`는 폐기 대상이라 이전 제외
- [x] 검증: **전 33개 모델 행 수 Supabase와 완전 일치** (`scripts/phase1_verify.sh`)
- [x] 완료 기준 충족: 시드 계정 로그인(JWT 발급) + profile/platform/jobs API 200 OK, 런타임 DB = `elaw@127.0.0.1`
- 메모: media 파일 동기화는 전환 시점(Phase 5)에 수행

### ✅ Phase 2 — 랜딩페이지 supabase-js 제거 (코드 완료 2026-06-06, 화면 검증은 Phase 3에서)
- [x] 신규 공개 API `GET /api/core/landing/` (`core/views_landing.py`, AllowAny) — 직군 30/기업 4/게시글 3/통계를 일괄 반환, 실데이터 200 OK 확인
- [x] `app/page.tsx` supabase 7개 호출 → 랜딩 API 1회 호출로 교체 (폴백 데이터 유지, ISR 300s 유지)
- [x] `lib/supabase.ts` 삭제, `@supabase/supabase-js` 제거, `.env.example`에서 `NEXT_PUBLIC_SUPABASE_*` 제거 (서버용 `API_URL` 도입)
- [x] `@vercel/analytics` 제거 (`layout.tsx`, `package.json`)
- [x] supabase 코드 참조 0건 (이력 주석 1줄·package-lock은 npm install 시 소멸)
- [x] 랜딩페이지 통계 화면 표시 확인 — 렌더링 HTML에 실데이터(6,000 문제/1346 공고/Nvidia 등) 포함 확인

### ✅ Phase 3 — 프론트엔드 컨테이너 서빙 (완료, 2026-06-06)
- [x] `npm install` + `next build` 성공 (13개 라우트, 랜딩 ISR 5분)
- [x] 클라이언트 코드는 이미 전부 상대경로(`api-client.ts`의 `BASE_URL=""`) — Next rewrites가 `/api`·`/media`를 `NEXT_PUBLIC_API_URL`(컨테이너 내부 백엔드)로 프록시. AI 생성용 `proxyTimeout` 300s 기존 설정 유지
- [x] `next start` 127.0.0.1:3000 — 랜딩 실데이터 렌더링, `/api` 프록시 경유 로그인 성공, 주요 페이지 200/리다이렉트 정상
- 메모: standalone 불필요 판단(node_modules 보유, next start 운영). 빌드/기동 시 `API_URL`·`NEXT_PUBLIC_API_URL`을 백엔드 주소로 지정 (Phase 4에서 supervisord 환경변수로 고정)

### ✅ Phase 4 — Ollama + nginx + supervisord 통합 (완료, 2026-06-06)
- [x] Ollama 별도 인스턴스 `:11435` — 풀백 런타임 전체(bin+lib, 2.1GB)와 모델(4.6GB) 복사, **100% GPU(V100) 추론 확인** (바이너리만 복사 시 llama-server 누락으로 실패 → lib 포함 전체 복사로 해결)
- [x] nginx `:80` 단일 진입점 — `/admin`→gunicorn, `/static`·`/media`→정적 서빙, 나머지→Next(:3000, `/api`는 Next rewrites 경유). **IP allowlist** `scripts/nginx_allowlist.conf` 적용
- [x] supervisord 5개 프로그램 (`/etc/supervisor/conf.d/elaw.conf`): postgres→ollama→backend(gunicorn :9002, gthread+keep-alive 75, timeout 300)→frontend→nginx
- [x] `DJANGO_DEBUG=False` 전환 + `STATIC_ROOT`/collectstatic (admin 정적 파일 nginx 서빙)
- [x] 부팅 자동 기동: `/run_jupyter.sh`에 ssh+supervisor 기동 훅 추가 (백업 `.bak`)
- [x] 완료 기준 충족: 전체 restart 후 자동 복구 + nginx 경유 랜딩/로그인/admin 정상

#### ⚠️ 사건 기록: self-hosted runner의 작업 디렉토리 초기화 (2026-06-06)
- 컨테이너에 GitHub Actions self-hosted runner가 있어 팀원이 `main` 푸시 시 `/volume/deploy.sh`가 `git reset --hard origin/main` 실행 → 커밋 전 변경분 소실. 로컬 백업으로 전량 복구.
- 조치: ① runner **일시정지** (재개: `cd /volume/actions-runner/actions-runner && RUNNER_ALLOW_RUNASROOT=1 nohup ./run.sh > /volume/actions-runner/runner.log 2>&1 &`) ② 이전 작업 전부를 **`container-migration` 브랜치로 커밋·푸시**(`66e496d`) — main(Vercel 자동배포)에는 무영향
- 후속(Phase 6): `deploy.sh`를 새 스택(`elaw_backend` 등 + 프론트 빌드) 기준으로 개정 후 runner 재개

### Phase 5 — 외부 노출 및 전환
- [ ] (관리자 승인 시) 매핑 포트로 외부 접속 검증 / (미승인 시) cloudflared를 `http://127.0.0.1:80`으로 변경해 named tunnel 운영
- [ ] 최종 데이터 동기화 (전환 시점 Supabase 차분 재적재)
- [ ] 팀(실사용자 4명) 접속 주소 전환 안내
- [ ] 모니터링 1주 후: Vercel 배포 중지, Supabase 프로젝트 일시정지(즉시 삭제 금지 — 롤백 대비 2주 보관), 로컬 PC 주 서버·`/volume/elaw` 풀백 스택 정지
- **완료 기준**: 외부에서 단일 주소로 전 기능 동작, 클라우드 의존 0

### Phase 6 — 운영 체계
- [ ] `pg_dump` 일일 백업 cron (`/volume/ELAW/backups`, 14일 보관) + 복원 리허설 1회
- [ ] 로그 로테이션, 디스크/메모리 점검 스크립트
- [ ] `docs/OPERATIONS.md` 개정 (새 단일 컨테이너 운영 절차)

## 5. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| **포트 매핑 미승인** | 직접 노출 불가 | Cloudflare named tunnel 폴백 (§1 결정 사항) |
| **PostgreSQL on NFS** (`/volume`이 NFS) | 락/fsync 이슈, 성능 저하 가능 | 사용자 4명 규모라 부하 미미. 초기화 후 `pgbench` 간이 검증. 문제 시 로컬 디스크(`/var/lib`) + `/volume`으로 일일 백업 구조로 변경 — 단, 컨테이너 재생성 시 복원 절차 필요 |
| HTTP 평문 (HTTPS 없음) | 비밀번호 평문 전송 | 직접 노출 채택 시 위험 수용 명시 필요. named tunnel 채택 시 자동 HTTPS ✅ |
| 컨테이너 재생성 시 apt 설치물(PG, nginx) 소실 | 서비스 불능 | 설치 절차를 `scripts/provision_container.sh`로 스크립트화 — 데이터는 `/volume`이라 안전 |
| 운영 중 풀백 스택과 자원/포트 충돌 | 기존 서비스 중단 | 신규 스택은 다른 포트(:80, :3000, :5432, :11435?) 사용, Ollama GPU 메모리는 V100 2장이라 여유. 전환 전까지 `/volume/elaw` 불간섭 원칙 |
| Supabase 조기 삭제 후 문제 발견 | 데이터 유실 | 일시정지 → 2주 보관 → 삭제 (Phase 5) |
| Quick tunnel URL 변동 (과도기) | 접속 주소 변경 | named tunnel(고정 도메인) 또는 기존 url_publisher 체계 임시 활용 |

## 6. 결정 필요 사항 (사용자)

1. **[필수] NAS 관리자에게 포트 매핑 요청** — "컨테이너 `c095ed446368`(SSH 12278)의 80 포트를 호스트 포트 하나로 매핑" 요청. 결과에 따라 Phase 5 방식 확정
2. Ollama를 신규 스택에서 **별도 인스턴스**로 띄울지, 과도기 동안 `/volume/elaw`의 기존 인스턴스(:11434)를 **공유**할지 (기본안: 별도 인스턴스, 포트 분리)
3. Supabase 보관 기간 (기본안: 전환 후 2주)
