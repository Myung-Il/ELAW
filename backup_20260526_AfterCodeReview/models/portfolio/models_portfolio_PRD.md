# 포트폴리오 생성 모델 PRD (Product Requirements Document)

> ELAW 플랫폼 핵심 AI — AI 포트폴리오 생성 모델 요구사항 정의서

---

## WHO — 이해관계자 및 담당 범위

### 주 담당팀
| 역할 | 담당 범위 |
|------|----------|
| **ML 팀** | Modelfile 설계, LoRA 어댑터(`my_portfolio_adapter.gguf`) 학습·관리, 프롬프트 엔지니어링 |
| **백엔드 팀** | `jobs/portfolio_ai.py` subprocess 연동, Ollama 서버 운영, 응답 후처리 (ANSI 제거), Portfolio 모델 저장 |
| **프론트엔드 팀** | 30~120초 로딩 UX 처리, 생성된 포트폴리오 에디터 화면 구현 |
| **DB 팀** | `portfolio_snapshots`, `portfolio_feedback` 테이블 유지 (RLHF 데이터 축적) |

### 사용자 (간접)
| 유형 | 사용 흐름 |
|------|----------|
| **학습자(student)** | 채용공고 선택 → 경력 입력 → AI 포트폴리오 초안 생성 (30~120초) → 편집 → 제출 |
| **백엔드 서비스** | `POST /api/jobs/<id>/apply/` 수신 → subprocess 호출 → 결과 저장 → 응답 반환 |

---

## WHAT — 요구사항 및 기능 명세

### 핵심 기능

**AI 포트폴리오 본문 자동 생성**
- 입력: 사용자 경력 서술(자유 형식) + 채용공고(JD) 전문
- 출력: 면접관이 바로 읽을 수 있는 한국어 포트폴리오 본문
- 처리: Ollama `mybot` 모델 subprocess 호출

### 모델 명세

**기반 모델**: `gemma2:2b` (Google Gemma 2, 2B 파라미터)

**파인튜닝**: `my_portfolio_adapter.gguf` (LoRA 어댑터)
- 취업 포트폴리오 도메인 특화
- 한국어 자연스러운 문체 강화
- 허구 경력 생성 억제

**Ollama 파라미터**
| 파라미터 | 값 | 설정 이유 |
|----------|-----|----------|
| `temperature` | 0.2 | 허구 내용 생성 최소화, 입력 데이터 충실 |
| `top_p` | 0.9 | 자연스러운 어휘 다양성 허용 |

**시스템 프롬프트**
```
당신은 주어진 데이터만 100% 신뢰하여 이력서를 재작성하는 깐깐한 취업 컨설턴트입니다.
반드시 100% 자연스러운 한국어만 사용해야 하며, 영어는 모두 한국어로 번역해서 출력하세요.
```

### 프롬프트 구조 및 작성 규칙

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

**규칙 설계 의도**
| 규칙 | 이유 |
|------|------|
| 실제 경험만 사용 | 허위 경력 기재는 채용 과정에서 치명적 결함. 신뢰도가 제품 핵심 가치 |
| 회사명 사용 범위 제한 | 여러 회사 지원 시 혼용 방지, 섹션별 일관성 유지 |
| 100% 한국어 | 한국 기업 채용 실무 요건, 영어 혼용 시 전문성 저하 인식 |

### Django 연동 인터페이스

```python
# backend/jobs/portfolio_ai.py
import subprocess
import re

def generate_portfolio(experience: str, jd: str) -> str:
    prompt = f"""..."""  # 위 프롬프트 조립
    
    result = subprocess.run(
        ['ollama', 'run', 'mybot', prompt],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    
    # ANSI 제어문자 제거
    clean_output = re.sub(r'\x1b\[[0-9;]*m', '', result.stdout)
    return clean_output.strip()
```

**저장 구조** (`Portfolio.content_json`)
```json
{
  "sections": [
    {
      "type": "ai_generated",
      "content": "AI가 생성한 포트폴리오 본문..."
    }
  ],
  "metadata": {
    "generation_method": "ollama_mybot",
    "job_posting_id": 5,
    "generated_at": "2026-05-21T10:00:00Z"
  }
}
```

### 성능 요구사항
| 항목 | 요구값 |
|------|--------|
| 응답 시간 | 30~120초 (CPU 기준) |
| 출력 언어 | 100% 한국어 |
| 허구 내용 생성율 | 0% (프롬프트 규칙 강제) |
| 동시 요청 처리 | Ollama 단일 인스턴스 기준 순차 처리 |

---

## WHEN — 일정 및 현재 상태

### 구현 완료
| 항목 | 상태 |
|------|------|
| `portfolio_maker.py` CLI 스크립트 | ✅ 완료 |
| `Modelfile` (gemma2:2b + 파라미터) | ✅ 완료 |
| `my_portfolio_adapter.gguf` LoRA 가중치 | ✅ 완료 |
| Django subprocess 연동 (`jobs/portfolio_ai.py`) | ✅ 완료 |
| ANSI 제어문자 후처리 | ✅ 완료 |
| `Portfolio` 모델 저장 | ✅ 완료 |
| 프론트엔드 로딩 처리 | ⚠️ 미완료 (BE는 완료, FE 연동 대기) |

### 미완료 항목 (우선순위 순)
| 우선순위 | 항목 | 담당 |
|----------|------|------|
| P0 | 운영 서버 Ollama 설치 및 mybot 모델 빌드 | 백엔드 팀 |
| P0 | 프론트엔드 30~120초 로딩 UX 구현 | 프론트엔드 팀 |
| P0 | 타임아웃(120초) 초과 시 에러 처리 + 재시도 UI | 프론트엔드 팀 |
| P1 | `portfolio_snapshots` 테이블 연동 (버전 이력 저장) | 백엔드 팀 + DB 팀 |
| P1 | `portfolio_feedback` RLHF 수집 UI | 프론트엔드 팀 |
| P2 | GPU 서버 환경 구성 (응답 시간 30초 이하 목표) | 인프라 |
| P2 | 포트폴리오 품질 평가 지표 수립 | ML 팀 |
| P2 | RLHF 피드백 기반 model_v2 재학습 | ML 팀 |
| P3 | 다국어 출력 옵션 (영문 포트폴리오 지원) | ML 팀 |

---

## WHERE — 범위 및 시스템 경계

### 파일 위치
```
models/portfolio/
├── portfolio_maker.py        # CLI + subprocess 래퍼
├── Modelfile                 # Ollama 모델 정의
└── my_portfolio_adapter.gguf # LoRA 가중치 (수정 금지)
```

### 연동 경계
```
[사용자] 경력 + JD 입력
    ↓
[Frontend] POST /api/jobs/<id>/apply/
    ↓ (30~120초 로딩 스피너)
[Django] jobs/portfolio_ai.py
    ↓ subprocess.run(['ollama', 'run', 'mybot', prompt])
[Ollama] mybot 모델 (gemma2:2b + LoRA)
    ↓ 포트폴리오 본문 생성
[Django] ANSI 제거 → Portfolio 저장 → Response
    ↓
[Frontend] 포트폴리오 에디터 화면
```

### 인프라 요구사항
| 컴포넌트 | 요구사항 |
|----------|---------|
| Ollama | 백엔드 서버와 동일 머신 (subprocess 호출) |
| `gemma2:2b` | 최소 4GB VRAM (GPU) 또는 8GB RAM (CPU) |
| `mybot` 모델 | `ollama create mybot -f Modelfile` 빌드 필요 |

### 연동 금지 사항
- `my_portfolio_adapter.gguf` 직접 수정·삭제 금지
- `Modelfile` 수정 시 반드시 `ollama rm mybot && ollama create mybot -f Modelfile` 재빌드
- Ollama 원격 API 호출 방식 미지원 (subprocess 방식 고정)

---

## WHY — 목적 및 비즈니스 가치

### 해결하는 핵심 문제

**1. 신입 개발자의 포트폴리오 작성 장벽**
포트폴리오는 취업의 첫 관문이지만, 어떻게 써야 하는지 몰라 지원 자체를 포기하는 경우가 많다. AI가 첫 초안을 생성해주면 "어떻게 시작할지"의 장벽을 제거한다.

**2. JD 맞춤 포트폴리오의 노동 집약성**
공고마다 강조하는 스킬과 문화가 다르므로 매번 포트폴리오를 다시 써야 한다. AI가 JD를 분석해 자동으로 초안을 조정함으로써 지원 비용을 대폭 줄인다.

**3. 허위 경력 기재 리스크**
일반 LLM은 그럴듯한 경력을 지어낸다. `temperature 0.2`와 엄격한 프롬프트 규칙으로 실제 경험만 사용하도록 강제한다. 이것이 이 모델의 핵심 신뢰 가치다.

### gemma2:2b 선택 이유
| 기준 | 선택 이유 |
|------|----------|
| 모델 크기 | 2B 파라미터 — 로컬 CPU 환경에서도 실행 가능 |
| 한국어 성능 | 한국어 토크나이징 품질 양호 |
| LoRA 호환 | GGUF 형식 LoRA 어댑터 적용 가능 |
| 비용 | 외부 API 호출 없음 — 운영 비용 0 |

### temperature 0.2 선택 이유
포트폴리오는 창의적 소설이 아니라 사실 기반 문서다. 높은 temperature는 그럴듯하지만 존재하지 않는 경험을 만들어낸다. 0.2는 자연스러운 문장 표현의 최소한의 유연성을 허용하면서 사실 기반 출력을 보장하는 임계값이다.

### 로컬 Ollama (subprocess) 방식 선택 이유
| 기준 | 외부 API | 로컬 Ollama |
|------|----------|------------|
| 운영 비용 | 토큰당 과금 | 0 |
| 데이터 보안 | 사용자 경력이 외부 전송 | 로컬 처리, 외부 미전송 |
| 응답 속도 | 빠름 (수초) | 느림 (30~120초) |
| 커스터마이징 | 제한적 | LoRA 자유 적용 |

→ 개인 경력 데이터를 외부로 보내지 않는 **데이터 보안**과 **운영 비용 절감**이 결정적 이유.

---

## HOW — 구현 방법 및 기술 제약

### 환경 설정 절차

```bash
# 1. Ollama 설치 (최초 1회)
# https://ollama.com 에서 OS별 설치

# 2. 기반 모델 다운로드
ollama pull gemma2:2b

# 3. mybot 모델 빌드
cd models/portfolio
ollama create mybot -f Modelfile

# 4. 동작 확인
ollama list | grep mybot
# mybot:latest    1.6 GB 이상 표시되어야 정상

# 5. 모델 테스트
ollama run mybot "백엔드 개발자 경험을 바탕으로 포트폴리오를 작성해줘"
```

### 백엔드 호출 코드 (현재 구현)

```python
# backend/jobs/portfolio_ai.py
import subprocess

def generate_portfolio(experience: str, jd_text: str) -> str:
    prompt = f"""
다음 정보를 바탕으로 면접관이 바로 읽을 수 있는 포트폴리오 본문을 작성해 줘.

[내가 실제로 다녔던 직장과 과거 경험]
{experience}

[내가 앞으로 입사하고 싶은 목표 회사의 공고]
{jd_text}

[엄격한 작성 규칙]
1. 경력 및 프로젝트 섹션에는 실제 경험에 적힌 내용만 작성한다.
2. 목표 회사명은 지원 동기나 포부 섹션에서만 사용한다.
3. 반드시 100% 자연스러운 한국어로만 작성한다.
"""
    result = subprocess.run(
        ['ollama', 'run', 'mybot', prompt],
        capture_output=True, text=True, encoding='utf-8'
    )
    return result.stdout
```

### 프론트엔드 UX 요구사항
```typescript
// POST /api/jobs/<id>/apply/ 호출 시
setIsLoading(true)                      // 로딩 오버레이 즉시 표시
const res = await fetch('/api/jobs/1/apply/', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(130_000)  // 130초 타임아웃
})
setIsLoading(false)

if (!res.ok) {
  // 타임아웃 또는 서버 오류 → 재시도 버튼 + 안내 메시지 표시
}
// 성공 → 포트폴리오 에디터 화면으로 이동
```

### RLHF 고도화 로드맵

```
현재 (model_v1):
  gemma2:2b + LoRA 어댑터 (my_portfolio_adapter.gguf)

단계 1 — 피드백 수집:
  portfolio_feedback 테이블에 사용자 편집 내용·평점 축적
  (used_for_training = False 상태)

단계 2 — 배치 추출:
  RLHFCollector.extract_training_batch()
  → used_for_training = True 마킹

단계 3 — 재학습 (model_v2):
  피드백 데이터로 LoRA 어댑터 재학습
  → my_portfolio_adapter_v2.gguf 생성

단계 4 — A/B 테스트:
  portfolio_snapshots.generation_method = "model_v2"로 신규 생성
  품질 비교 후 전환
```

### 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ollama: command not found` | Ollama 미설치 | ollama.com 설치 |
| `model 'mybot' not found` | 모델 빌드 안 됨 | `ollama create mybot -f Modelfile` |
| 출력이 영어로 나옴 | 시스템 프롬프트 미적용 | `ollama rm mybot` 후 재빌드 |
| 응답 120초 초과 | CPU 환경 | GPU 서버 구성 또는 타임아웃 상향 |
| 허구 경력 포함 | temperature 상승 또는 Modelfile 변경 | Modelfile `temperature 0.2` 확인 후 재빌드 |
| ANSI 코드가 저장됨 | 후처리 누락 | `re.sub(r'\x1b\[[0-9;]*m', '', output)` 적용 |
