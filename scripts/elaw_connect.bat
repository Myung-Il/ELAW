@echo off
rem ─────────────────────────────────────────────────────
rem ELAW 접속 터널 (팀원용 원클릭)
rem 사전 조건: 본인 SSH 공개키가 서버에 등록되어 있어야 함
rem   (등록 요청: 관리자에게 id_ed25519.pub 전달)
rem 실행하면 브라우저에서 http://localhost:8080 으로 ELAW 사용 가능.
rem 이 창을 닫으면 접속이 끊깁니다.
rem ─────────────────────────────────────────────────────
echo ELAW 터널 연결 중... 연결되면 브라우저에서 http://localhost:8080 을 여세요.
start "" http://localhost:8080
ssh -L 8080:127.0.0.1:80 -p 12278 -o ServerAliveInterval=30 root@220.67.89.246 -N
