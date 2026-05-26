# Models PRD (Product Requirements Document)

> ELAW 플랫폼 AI/ML 모델 요구사항 정의서

---

## WHO — 이해관계자 및 담당 범위

### 주 담당팀
| 역할 | 담당 범위 |
|------|----------|
| **ML 팀** | 모델 설계·학습·유지보수, 파이프라인 구현 |
| **백엔드 팀** | Django View에서 ML 모듈 호출 연동, Ollama 서버 관리 |
| **DB 팀** | `job_problems`, `learning_path_meta`, `problem_recommendations` 테이블 제공 |

### 사용자 (간접)
| 유형 | 모델 사용 방식 |
|------|--------------|
| **학습자** | 진단 퀴즈 응시 → 맞춤 문제 추천 수신 → 포트폴리오 AI 초안 생성 |
| **백엔드 서비스** | Django View에서 SeedQuiz·Recommend·portfolio_maker 직접 호출 |

---

## WHAT — 요구사항 및 기능 명세

### 모듈 1 — 문제 추천 시스템 (`curriculum/`)

#### SeedQuiz 요구사항
- 입력: `username`, `problems (dict)`, `ordered_path (list)`
- 10문제 샘플링: `university_level 5 / junior_level 3 / middle_level 2 / senior_level 0`
- 샘플링 순서: `ordered_path` 앞쪽 우선 (선수 개념 먼저)
- 필수 제공 메서드:

| 메서드 | 설명 |
|--------|------|
| `get_question(index)` | 특정 인덱스 문제 조회 |
| `get_all_questions()` | 전체 10문제 목록 |
| `submit(index, answer)` | 답안 제출 및 채점 |
| `get_progress()` | 진행 상태 (answered/total/accuracy) |
| `get_result()` | 최종 결과 → Voting으로 전달 |
| `export_session()` / `import_session()` | 세션 직렬화·복원 (이어풀기) |

#### Voting 요구사항
- 입력: `SeedQuiz.get_result()` 반환값
- 구간 판별 및 가중치 결정:

| 구간 | 정답률 | GKT | SAKT | DKT |
|------|--------|-----|------|-----|
| 낮음 | < 60% | 0.40 | 0.20 | 0.40 |
| 괜찮음 | 60~77% | 0.45 | 0.20 | 0.35 |
| 높음 | ≥ 77% | 0.50 | 0.20 | 0.30 |

- `update(is_correct)`: 문제 풀이 후 실시간 정답률·구간 재계산
- `get_weak_categories()`: 카테고리별 오답률 내림차순 반환

#### 분류기 3종 요구사항

**GKT (Graph-based Knowledge Tracing)**
- 입력: 응답 이력, `dependency_graph`
- 로직: 오답 노드 + 선수과목 전파 → `weak_score`, 카테고리 미숙도 → `mastery_score`
- 출력: `(weak_score + mastery_score) / 2` (0.0~1.0, 높을수록 취약)

**SAKT (Self-Attentive Knowledge Tracing)**
- 입력: 최근 N=10 응답 이력
- 로직: 카테고리별 attention weight = `Σ (i+1)/n` (recency bias)
- 출력: 현재 문제 카테고리의 attention weight (0.0~1.0, 높을수록 최근 활성)

**DKT (Deep Knowledge Tracing)**
- 입력: 전체 응답 이력
- 로직: 카테고리별 `correct / total`, 미경험 카테고리 기본값 0.5
- 출력: 예상 정답 확률 (0.0~1.0)

#### Recommend 요구사항
- 소프트 보팅: `total = w_GKT × gkt + w_SAKT × sakt + w_DKT × dkt`
- 이미 응답한 문제는 후보 제외
- `get_recommendations(top_n=5)`: 점수 내림차순 상위 N개 반환
- `update(question_id, is_correct, category, subcategory)`: 온라인 업데이트

#### Recommend 출력 스키마
```python
[
  {
    "question_id": 42,
    "category": "Deep Learning",
    "subcategory": "CNN",
    "difficulty": "junior_level",
    "question": "...",
    "choices": ["A", "B", "C", "D"],
    "scores": { "GKT": 0.75, "SAKT": 0.33, "DKT": 0.50, "total": 0.54 }
  },
  ...
]
```

---

### 모듈 2 — 포트폴리오 생성 (`portfolio/`)

#### portfolio_maker 요구사항
- 입력: 사용자 경력 서술, 채용공고(JD) 텍스트
- 처리: Ollama `mybot` 모델 subprocess 호출
- 출력: 한국어 포트폴리오 본문 (허구 내용 금지)
- 응답 시간: 30~120초 (하드웨어 의존)

#### Ollama mybot 모델 명세
- 기반 모델: `gemma2:2b`
- 파인튜닝: `my_portfolio_adapter.gguf` (LoRA 어댑터)
- `temperature: 0.2` — 허구 생성 억제, 입력 데이터 충실
- `top_p: 0.9` — 자연스러운 어휘 다양성

#### 작성 규칙 (프롬프트 내 강제)
1. `경력 및 프로젝트` 섹션 — 실제 경험만 사용
2. 목표 회사명 — `지원 동기` 또는 `포부` 섹션에서만 언급
3. 출력 언어 — 100% 한국어

---

### 모듈 3 — 학습경로 빌더 (`curriculum/curriculum_builder.py`)

> **주의**: 런타임 모듈이 아닌 DB 데이터 사전 생성 스크립트

- Sentence-BERT 임베딩으로 `DB/LearningPaths/` JSON 생성
- `transformers` 미설치 시 TF-IDF/Jaccard 자동 폴백
- GPU 자동 감지 (CUDA 가용 시 사용, CPU 폴백)
- 엣지 생성 파라미터: `skill_weight=0.55`, `scenario_weight=0.45`, `min_combined_score=0.2`, `max_prereqs_per_target=3`

---

## WHEN — 일정 및 현재 상태

### 현재 상태
| 항목 | 상태 |
|------|------|
| SeedQuiz 구현 | 완료 |
| Voting 구현 | 완료 |
| GKT / SAKT / DKT 구현 | 완료 |
| Recommend 구현 | 완료 |
| 통합 테스트 (`test.py`) | 완료 |
| CurriculumBuilder (LearningPaths 생성) | 완료 |
| portfolio_maker.py (CLI) | 완료 |
| Ollama mybot 모델 파인튜닝 | 완료 |
| **Django 백엔드 연동** | **미완료** |
| **API 엔드포인트 래핑** | **미완료** |

### 우선순위 작업
| 우선순위 | 항목 | 담당 |
|----------|------|------|
| P0 | Django View에서 SeedQuiz·Recommend 호출 연동 | 백엔드 팀 + ML 팀 |
| P0 | 퀴즈 세션 관리 방식 결정 (Django session vs Redis) | 백엔드 팀 |
| P1 | 문제 추천 API 엔드포인트 설계 및 구현 | 백엔드 팀 |
| P1 | Ollama 서버 운영 환경 설정 | 백엔드 팀 |
| P2 | GKT 모델 신경망 기반으로 고도화 | ML 팀 |
| P2 | RLHF 피드백 기반 포트폴리오 모델 재학습 | ML 팀 |

---

## WHERE — 범위 및 시스템 경계

### 파일 위치
```
models/
├── curriculum/
│   ├── seedquiz.py           # 진단 퀴즈
│   ├── voting.py             # 구간 판별·가중치
│   ├── recommend.py          # 소프트 보팅 추천
│   ├── curriculum_builder.py # LearningPaths 사전 생성 (빌드 타임)
│   ├── test.py               # end-to-end 통합 테스트
│   └── ml/
│       ├── gkt.py
│       ├── sakt.py
│       └── dkt.py
└── portfolio/
    ├── portfolio_maker.py    # CLI + subprocess 래퍼
    ├── Modelfile             # Ollama 모델 정의
    └── my_portfolio_adapter.gguf
```

### 연동 경계
| 방향 | 대상 | 방식 |
|------|------|------|
| Django → curriculum | `SeedQuiz`, `Voting`, `Recommend` | Python import (직접 호출) |
| Django → portfolio | `portfolio_maker.py` | subprocess |
| DB → curriculum | `JobProblem`, `LearningPathMeta` | Django ORM (백엔드에서 주입) |
| curriculum → DB | `problem_recommendations` | Django ORM (백엔드에서 저장) |

### 독립성 원칙
- `curriculum/` 모듈: Django ORM 직접 import **없음** — 백엔드 View가 DB 데이터를 주입
- `portfolio/` 모듈: Ollama 로컬 실행 의존, 외부 네트워크 불필요

---

## WHY — 목적 및 비즈니스 가치

### 해결하는 문제
1. **획일적 학습 콘텐츠**: 수준 무관 동일 문제 제공 → 학습 효율 저하
2. **포트폴리오 작성 부담**: 신입 개발자의 지원 진입 장벽
3. **약점 파악 어려움**: 어느 개념이 부족한지 정량적으로 알기 어려움

### 앙상블 설계 이유
| 모델 | 단독 한계 | 앙상블에서의 역할 |
|------|----------|----------------|
| GKT | 그래프 구조에만 의존, 학습 이력 미반영 | 선수과목 기반 미래 취약점 선제 차단 |
| SAKT | 최근 이력만 반영, 장기 약점 놓침 | 현재 학습 흐름의 연속성 유지 |
| DKT | 과거 정답률만 반영, 새 영역 추천 부재 | 성취감 제공, 자신감 유지 |

**정답률에 따른 GKT 가중치 상승**: 수준이 높을수록 아직 경험하지 않은 고급 개념의 선수 취약점을 선제 파악하는 것이 더 중요하기 때문.

### 포트폴리오 모델 temperature 0.2 선택 이유
취업 포트폴리오에서 허구 경력 생성은 치명적 결함. 낮은 temperature로 입력 데이터에 충실한 출력을 강제하고, 창의적 표현은 top_p 0.9로 자연스러운 문장 구성에 한정.

---

## HOW — 구현 방법 및 기술 제약

### Django 연동 인터페이스 (예정)

```python
# backend/core/views.py (미구현 — 연동 설계 예시)
from models.curriculum.seedquiz import SeedQuiz
from models.curriculum.voting   import Voting
from models.curriculum.recommend import Recommend

def start_quiz(request):
    job_role = request.data['job_role']
    problems = {
        p.original_question_id: {
            'question_id': p.original_question_id,
            'difficulty': p.difficulty,
            'category': p.category,
            'subcategory': p.subcategory,
            'question': p.question,
            'choices': p.choices,
            'correct_answer': p.correct_answer,
            'explanation': p.explanation,
        }
        for p in JobProblem.objects.filter(job_role=job_role)
    }
    meta = LearningPathMeta.objects.get(job_role=job_role)
    quiz = SeedQuiz(str(request.user.id), problems, meta.ordered_path)
    request.session['quiz'] = quiz.export_session()
    return Response({'questions': quiz.get_all_questions()})

def get_recommendations(request):
    quiz_session = request.session['quiz']
    # ... quiz 복원, Voting, Recommend 순서로 호출
    # ... 결과를 ProblemRecommendation 테이블에 저장
```

### 세션 관리 결정 사항 (미확정)
- **옵션 A**: Django 기본 세션 (SQLite/DB 저장) — 구현 단순
- **옵션 B**: Redis 세션 — 성능·확장성 우수, 추가 인프라 필요

### 테스트 실행

```bash
cd models/curriculum
python test.py          # 전체 파이프라인 통합 테스트
```

### Ollama 환경 설정

```bash
# 1. gemma2:2b 다운로드 (최초 1회)
ollama pull gemma2:2b

# 2. mybot 모델 빌드
cd models/portfolio
ollama create mybot -f Modelfile

# 3. 동작 확인
ollama list | grep mybot
ollama run mybot "백엔드 개발자 포트폴리오 작성해줘"
```

### 제약사항
- Ollama는 백엔드 서버와 동일 머신 또는 로컬 네트워크에서 실행 필요
- `curriculum_builder.py` 재실행 시 `DB/LearningPaths/` JSON 파일 덮어쓰기 → DB `load_problems --reset` 필요
- 모든 ML 모듈은 Django ORM import 없음 — DB 데이터는 반드시 백엔드 View에서 Python dict/list로 주입
