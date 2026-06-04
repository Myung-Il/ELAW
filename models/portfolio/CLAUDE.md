# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 역할

`portfolio/`는 로컬 Ollama 모델(`mybot`)을 사용해 사용자의 경력 서술과 채용공고(JD)를 입력받아 **한국어 포트폴리오 본문**을 생성하는 모듈이다. Django 앱과 독립된 순수 Python 스크립트로, 백엔드에서 subprocess로 호출한다.

## 파일 구성

| 파일 | 역할 |
|------|------|
| `portfolio_maker.py` | CLI 인터페이스 + Ollama subprocess 호출 |
| `Modelfile` | Ollama 모델 정의 (`portfolio_merged.gguf` 기반) |
| `portfolio_merged.gguf` | 베이스 모델 + LoRA 병합 완료된 단독 가중치 — 직접 수정 금지 |

## 모델 명세 (`Modelfile`)

```
FROM ./portfolio_merged.gguf
PARAMETER temperature 0.2
PARAMETER top_p 0.9
SYSTEM "당신은 주어진 데이터만 100% 신뢰하여 이력서를 재작성하는 깐깐한 취업 컨설턴트입니다.
        반드시 100% 자연스러운 한국어만 사용해야 하며, 영어는 모두 한국어로 번역해서 출력하세요."
```

- `temperature 0.2`: 허구 내용 생성 억제, 입력 데이터 충실
- `top_p 0.9`: 자연스러운 한국어 어휘 범위 유지

## 실행 방법

### CLI 직접 실행
```bash
cd models/portfolio
python portfolio_maker.py
# 두 차례 다중 줄 입력 요청:
# [1] 경험 서술 → 입력 후 새 줄에 '완료' 입력
# [2] 채용공고(JD) → 입력 후 새 줄에 '완료' 입력
```

### Ollama 환경 설정 (최초 1회)
```bash
# portfolio_merged.gguf는 베이스 모델이 이미 병합된 단독 모델이라
# 별도 베이스 모델(ollama pull gemma2:2b) 다운로드가 필요 없다.
cd models/portfolio
ollama create mybot -f Modelfile
ollama list | grep mybot    # 확인
```

## 프롬프트 구조

```python
prompt = f"""
다음 정보를 바탕으로 면접관이 바로 읽을 수 있는 포트폴리오 본문을 작성해 줘.

[내가 실제로 다녔던 직장과 과거 경험]
{experience}

[내가 앞으로 입사하고 싶은 목표 회사의 공고]
{jd}

[엄격한 작성 규칙]
1. 경력 및 프로젝트 섹션에는 실제 경험에 적힌 내용만 작성한다.
2. 목표 회사명은 지원 동기나 포부 섹션에서만 사용한다.
3. 반드시 100% 자연스러운 한국어로만 작성한다.
"""
```

## Django 연동 방식 (`backend/jobs/portfolio_ai.py`)

```python
import subprocess

result = subprocess.run(
    ['ollama', 'run', 'mybot', prompt],
    capture_output=True,
    text=True,
    encoding='utf-8'
)
portfolio_text = result.stdout  # ANSI 제어문자 제거 후 저장
```

- 응답 시간: **30~120초** (하드웨어 의존)
- Django에서 호출 시 프론트엔드에 로딩 처리 필수
- 에러 발생 시 `result.returncode != 0` 확인

## 주의사항

- `portfolio_merged.gguf`: 베이스+LoRA 병합 완료된 가중치 파일 — 임의 수정·삭제 금지
- `Modelfile` 수정 후에는 `ollama rm mybot && ollama create mybot -f Modelfile` 재빌드 필요
- Ollama는 백엔드 서버와 동일 머신에서 실행되어야 함 (subprocess 호출)
- 출력이 영어로 나오면 Modelfile의 SYSTEM 프롬프트가 적용되지 않은 것 → 모델 재빌드
