# ELAW 컨테이너 통합 스택 운영 가이드

> NAS 도커 컨테이너(`/volume/ELAW`) 단독 운영 체계의 운영 절차서.
> 구 클라우드 체계(Vercel + Supabase + 로컬 PC)의 운영 문서는 `OPERATIONS.md` — 전환 완료 시 본 문서가 대체한다.
> 작성: 2026-06-06 (Phase 6)

## 1. 아키텍처

```
[승인된 PC] ── SSH 터널(:12278) 또는 매핑 포트 ──▶ nginx :80 (IP allowlist)
                                                    ├─ /admin, /static, /media → Django/정적
                                                    └─ / (+ /api 프록시)      → Next.js :3000
                                                          Next rewrites /api,/media → gunicorn :9002
gunicorn :9002 ──▶ PostgreSQL :5432 (로컬, /volume/ELAW/data/postgres)
            └───▶ Ollama :11435 (mybot, V100 GPU)
```

| 프로세스 | 포트 | supervisord 프로그램 | 로그 |
|---|---|---|---|
| PostgreSQL 16 | 127.0.0.1:5432 | `elaw_postgres` | `logs/postgres.log` |
| Ollama | 127.0.0.1:11435 | `elaw_ollama` | `logs/ollama.log` |
| Django (gunicorn) | 127.0.0.1:9002 | `elaw_backend` | `logs/backend.log`, `logs/gunicorn_access.log` |
| Next.js | 127.0.0.1:3000 | `elaw_frontend` | `logs/frontend.log` |
| nginx | 0.0.0.0:80 | `elaw_nginx` | `logs/nginx.log` |
| cron (백업/로테이션) | - | `elaw_cron` | `logs/cron.log` |

※ 풀백 스택(`/volume/elaw`, :9000/:11434)과 포트가 분리되어 있어 공존 가능. 전환 완료 후 풀백 정지 예정.

## 2. 일상 운영 명령

```bash
supervisorctl status                  # 전체 상태
supervisorctl restart elaw_backend    # 개별 재시작
supervisorctl restart all             # 전체 재시작 (postgres 포함 — 약 30초)
tail -f /volume/ELAW/logs/backend.log # 로그 보기
```

## 3. 접속 방법

### SSH 터널 (기본 — 관리자 매핑 불필요)
1. 본인 PC의 SSH 공개키를 서버 `~/.ssh/authorized_keys`에 등록 (= 접속 승인)
2. `scripts/elaw_connect.bat` 실행 (또는 `ssh -L 8080:127.0.0.1:80 -p 12278 root@220.67.89.246 -N`)
3. 브라우저에서 `http://localhost:8080`

### 직접 접속 (NAS 관리자가 80 포트 매핑해 준 경우)
- `http://220.67.89.246:<매핑포트>` — **`scripts/nginx_allowlist.conf`에 등록된 IP만 허용**
- IP 추가: 파일에 `allow x.x.x.x;` 한 줄 추가 → `supervisorctl restart elaw_nginx`

## 4. 백업 / 복원

- **자동 백업**: 매일 03:30 KST `scripts/backup_db.sh` → `/volume/ELAW/backups/elaw_*.dump` (14일 보관, `backups/backup.log` 기록)
- **수동 백업**: `bash /volume/ELAW/scripts/backup_db.sh`
- **복원**:
  ```bash
  supervisorctl stop elaw_backend
  su -s /bin/bash postgres -c "dropdb elaw && createdb -O elaw elaw"
  su -s /bin/bash postgres -c "pg_restore -d elaw /volume/ELAW/backups/elaw_<날짜>.dump"
  supervisorctl start elaw_backend
  ```
- 복원 리허설(운영 DB 무영향): `bash /volume/ELAW/scripts/restore_rehearsal.sh`

## 5. 컨테이너 재시작 / 재생성 시

- **재시작**: `/run_jupyter.sh`의 부팅 훅이 sshd + supervisord를 자동 기동 → 전 서비스 자동 복구
- **재생성**(이미지부터 새로): apt 설치물이 사라짐 → `bash /volume/ELAW/scripts/provision_container.sh` 한 번 실행
  (데이터·코드·백업은 `/volume`에 있어 보존됨)

## 6. 배포 (CI)

- self-hosted runner는 **일시정지 상태** (이전 작업 보호).
  재개: `cd /volume/actions-runner/actions-runner && RUNNER_ALLOW_RUNASROOT=1 nohup ./run.sh > /volume/actions-runner/runner.log 2>&1 &`
- 전환 완료(`container-migration` → `main` 병합) 후: `cp /volume/ELAW/scripts/deploy_container.sh /volume/deploy.sh` 로 CI 배포 스크립트 교체
- ⚠️ CI는 `git reset --hard origin/main`을 수행 — **서버의 미커밋 수정은 푸시 시점에 삭제됨**. 수동 수정은 반드시 커밋·푸시.

## 7. 환경 변수 / 설정 위치

| 항목 | 위치 |
|---|---|
| Django 설정 (DB 접속, DEBUG 등) | `backend/.env` (git 미추적 — 백업: `.env.bak.*`) |
| 프론트 빌드/기동 env | supervisord conf의 `environment=` (`NEXT_PUBLIC_API_URL`, `API_URL` = :9002) |
| nginx 라우팅 / allowlist | `scripts/nginx_elaw.conf` / `scripts/nginx_allowlist.conf` |
| supervisord | `scripts/supervisord_elaw.conf` (원본) → `/etc/supervisor/conf.d/elaw.conf` (적용본) |
| DB 데이터 | `/volume/ELAW/data/postgres` |
| Ollama 모델 | `/volume/ELAW/data/ollama-models` (runtime: `/volume/ELAW/runtime/ollama`) |

설정 원본을 수정한 경우: supervisord는 `cp scripts/supervisord_elaw.conf /etc/supervisor/conf.d/elaw.conf && supervisorctl reread && supervisorctl update`, nginx는 심볼릭 링크라 `supervisorctl restart elaw_nginx`만.

## 8. 트러블슈팅

| 증상 | 확인/조치 |
|---|---|
| 502 Bad Gateway | `supervisorctl status` — backend/frontend 죽음 → 해당 로그 확인 후 restart |
| 로그인 되는데 데이터 안 보임 | `logs/backend.log`에서 DB 연결 오류 확인 → `elaw_postgres` 상태 확인 |
| AI 포트폴리오 생성 실패 | `curl http://127.0.0.1:11435/api/version`, `logs/ollama.log` — `llama-server binary not found`면 runtime/lib 디렉토리 유실 (provision 5절 참고) |
| 외부 접속 403 | 출발지 IP가 allowlist에 없음 — §3 IP 추가 |
| 디스크 사용량 점검 | `df -h /volume`, `du -sh /volume/ELAW/backups /volume/ELAW/logs` |
| 시드 계정 | `minjun.kim@elaw.kr` / `elaw1234!` |
