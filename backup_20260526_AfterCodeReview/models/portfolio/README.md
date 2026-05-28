# portfolio/ — AI 포트폴리오 생성기

로컬 Ollama 모델(`mybot`)을 사용해 사용자의 경력 서술과 채용공고(JD)를 입력받아 면접관이 바로 읽을 수 있는 한국어 포트폴리오 본문을 생성한다.

---

## 파일 구성

| 파일 | 설명 |
|------|------|
| `portfolio_maker.py` | CLI 인터페이스 — 경험·JD 입력 → Ollama 호출 → 결과 출력 |
| `Modelfile` | Ollama 모델 정의 — gemma2:2b 기반, temperature 0.2 |
| `my_portfolio_adapter.gguf` | LoRA 파인튜닝 가중치 |

---

## 사전 준비

### 1. Ollama 설치

[https://ollama.com](https://ollama.com) 에서 설치 후:

```bash
ollama --version   # 설치 확인
```

### 2. mybot 모델 빌드

```bash
cd models/portfolio

# Modelfile 기준으로 mybot 모델 생성
ollama create mybot -f Modelfile

# 생성 확인
ollama list | grep mybot
```

### 3. 기반 모델 사전 다운로드 (최초 1회)

```bash
ollama pull gemma2:2b
```

---

## CLI 직접 실행

```bash
cd models/portfolio
python portfolio_maker.py
```

실행하면 두 가지 입력을 순서대로 요청한다:

```
[1] 당신의 경험 및 역할을 자유롭게 입력하세요.
👉 (복사+붙여넣기를 한 뒤, 다 썼으면 새로운 줄에 '완료'라고 적고 엔터를 치세요)

> 3년간 Spring Boot 기반 REST API 개발...
> 완료

[2] 지원할 채용 공고(JD)의 내용을 그대로 복사/붙여넣기 하세요.
👉 ...
```

입력 완료 후 Ollama가 포트폴리오 본문을 출력한다.

---

## Django 백엔드 연동 방식

`backend/jobs/portfolio_ai.py`에서 subprocess로 호출한다.

```python
import subprocess

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

result = subprocess.run(
    ['ollama', 'run', 'mybot', prompt],
    capture_output=True,
    text=True,
    encoding='utf-8'
)
portfolio_text = result.stdout
```

- **응답 시간**: 30~120초 (로컬 하드웨어에 따라 다름)
- Django에서는 응답 대기 중 프론트엔드에 로딩 스피너 표시 필요

---

## 모델 상세

### Modelfile

```
FROM gemma2:2b

PARAMETER temperature 0.2
PARAMETER top_p 0.9

SYSTEM """
당신은 주어진 데이터만 100% 신뢰하여 이력서를 재작성하는 깐깐한 취업 컨설턴트입니다.
반드시 100% 자연스러운 한국어만 사용해야 하며, 영어는 모두 한국어로 번역해서 출력하세요.
"""
```

- **기반 모델**: `gemma2:2b` (Google Gemma 2, 2B 파라미터)
- **파인튜닝**: `my_portfolio_adapter.gguf` (LoRA 어댑터)
- **temperature 0.2**: 창의적 허구 생성을 억제하고 입력 데이터에 충실한 출력 유도
- **top_p 0.9**: 자연스러운 한국어 어휘 다양성 유지

### 작성 규칙 (프롬프트 내 하드코딩)

1. `경력 및 프로젝트` 섹션 — 실제 경험 내용만 사용 (허구 금지)
2. 목표 회사명 — `지원 동기` 또는 `포부` 섹션에서만 언급
3. 출력 언어 — 100% 한국어 (영어 용어도 한국어로 번역)

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ollama: command not found` | Ollama 미설치 | [ollama.com](https://ollama.com) 에서 설치 |
| `model 'mybot' not found` | 모델 빌드 안 됨 | `ollama create mybot -f Modelfile` |
| 응답이 영어로 나옴 | 시스템 프롬프트 미적용 | `ollama rm mybot` 후 재빌드 |
| 응답 시간 120초 초과 | CPU 환경 | GPU 환경 권장, 타임아웃 설정 상향 검토 |
