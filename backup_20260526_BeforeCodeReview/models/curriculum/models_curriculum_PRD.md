# 문제 추천 시스템 PRD (Product Requirements Document)

> ELAW 플랫폼 핵심 AI — 개인화 문제 추천 파이프라인 요구사항 정의서

---

## WHO — 이해관계자 및 담당 범위

### 주 담당팀
| 역할 | 담당 범위 |
|------|----------|
| **ML 팀** | SeedQuiz·Voting·GKT·SAKT·DKT·Recommend 설계 및 구현 |
| **백엔드 팀** | Django View에서 모듈 호출, DB 데이터 주입, 세션 관리, API 엔드포인트 래핑 |
| **DB 팀** | `job_problems`, `learning_path_meta`, `job_problem_solve_history`, `problem_recommendations` 테이블 제공 |

### 사용자 (간접)
| 유형 | 사용 흐름 |
|------|----------|
| **학습자(student)** | 직군 선택 → 진단 퀴즈 10문제 → 추천 문제 수신 → 풀이 → 재추천 반복 |
| **백엔드 서비스** | Django View가 DB 데이터를 주입해 모듈을 직접 Python으로 호출 |

---

## WHAT — 요구사항 및 기능 명세

### 모듈 1: SeedQuiz — 진단 퀴즈

**목적**: 신규 학습자의 현재 지식 수준을 10문제로 빠르게 진단

**입력 요구사항**
```python
SeedQuiz(
    username: str,           # 사용자 식별자
    problems: dict,          # {question_id: problem_dict}
    ordered_path: list       # 선수과목 순서로 정렬된 question_id 리스트
)
# problem_dict 필수 키: question_id, difficulty, category, subcategory,
#                       question, choices, correct_answer, explanation
```

**샘플링 규칙** (변경 시 테스트 재검증 필요)
| 난이도 | 할당 수 |
|--------|--------|
| university_level | 5 |
| junior_level | 3 |
| middle_level | 2 |
| senior_level | 0 (제외) |

- 순서: `ordered_path` 앞에서부터 할당량 채울 때까지 순회
- 동일 index 재제출 시 덮어쓰기 허용 (답안 수정)
- `get_question()` 반환값에 `correct_answer` 미포함 (채점 전 노출 방지)

**공개 인터페이스**
| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `get_question(index)` | dict | index번째 문제 (정답 제외) |
| `get_all_questions()` | list[dict] | 전체 10문제 목록 |
| `submit(index, answer)` | dict | 채점 결과 `{is_correct, correct_answer, explanation}` |
| `get_progress()` | dict | `{answered, total, correct, accuracy, is_completed}` |
| `get_result()` | dict | `{username, total, correct, accuracy, responses[]}` |
| `export_session()` | dict | 세션 직렬화 (Django session 저장용) |
| `import_session(session)` | None | 세션 복원 (이어풀기) |

---

### 모듈 2: Voting — 구간 판별 및 가중치 관리

**목적**: 정답률을 3구간으로 분류하고 세 분류기의 보팅 가중치를 결정

**구간 경계값**
```python
ZONE_LOW = 60.0   # 60% 미만 → "낮음"
ZONE_MID = 77.0   # 60~77%  → "괜찮음", 77% 이상 → "높음"
```

**구간별 가중치**
| 구간 | 정답률 | GKT | SAKT | DKT | 설계 의도 |
|------|--------|-----|------|-----|----------|
| 낮음 | < 60% | 0.40 | 0.20 | 0.40 | GKT·DKT 균형 — 취약점 탐지 + 성취 유지 |
| 괜찮음 | 60~77% | 0.45 | 0.20 | 0.35 | GKT 강화 — 약점 집중 보완 |
| 높음 | ≥ 77% | 0.50 | 0.20 | 0.30 | GKT 최대 — 미경험 취약점 선제 차단 |

**온라인 업데이트**: `update(is_correct)` 호출 시 누적 정답률 재계산 → 구간 자동 전환

**공개 인터페이스**
| 메서드 | 반환 | 설명 |
|--------|------|------|
| `get_zone()` | str | "낮음" \| "괜찮음" \| "높음" |
| `get_weights()` | dict | `{GKT, SAKT, DKT}` float |
| `get_weak_categories()` | dict | `{category: 오답률}` 내림차순 |
| `update(is_correct)` | None | 누적 정답률 갱신 |
| `get_status()` | dict | `{accuracy, zone, weights, weak_categories}` |

---

### 모듈 3: 분류기 3종 (`ml/`)

#### GKT — Graph-based Knowledge Tracing

**목적**: 선수과목 그래프 위에서 미래 취약 가능성을 예측

**알고리즘**
```
1. node_mastery[category] = correct / total  (카테고리별 숙련도)
2. weak_nodes = {오답 question_id} ∪ {오답 노드의 모든 Preceding_ID}
3. predict(problem):
     weak_score    = 1.0 if question_id ∈ weak_nodes else 0.0
     mastery_score = 1.0 - node_mastery.get(category, 0.5)
     return (weak_score + mastery_score) / 2
```

- 출력: 0.0~1.0 (높을수록 미래에 취약할 가능성 높음)
- 미경험 카테고리 기본 mastery = 0.5 (중립)
- `dependency_graph` 엣지의 `Target_ID` → `Preceding_ID` 방향으로 전파

#### SAKT — Self-Attentive Knowledge Tracing

**목적**: 최근 학습 패턴과 현재 문제의 연관성을 attention으로 측정

**알고리즘**
```
1. recent = responses[-window:]          (window 기본값 = 10)
2. attention_weight[category] = Σ (i+1)/n  (최근일수록 선형 증가)
3. 정규화: weight / sum(weights)
4. predict(problem): attention_weight.get(category, 0.0)
```

- 출력: 0.0~1.0 (높을수록 최근 활성화된 카테고리)
- 응답 없을 때: `0.0` 반환
- 학습 연속성 유지 역할 — 최근 공부한 영역 계속 강화

#### DKT — Deep Knowledge Tracing

**목적**: 카테고리 정답률 기반으로 문제를 맞출 확률 예측

**알고리즘**
```
1. category_stats[category] = {total, correct}
2. predict(problem): correct / total
   (미경험 카테고리: 0.5 중립값)
```

- 출력: 0.0~1.0 (높을수록 잘 풀 수 있는 문제)
- 성취감 제공 역할 — 학습 의욕 유지

---

### 모듈 4: Recommend — 소프트 보팅 추천기

**목적**: 세 분류기 점수를 Voting 가중치로 합산해 최적 추천 문제 선정

**소프트 보팅 공식**
```
total = w_GKT × GKT.predict(p) + w_SAKT × SAKT.predict(p) + w_DKT × DKT.predict(p)
```

**후보 필터링**: 이미 응답한 `question_id` 자동 제외

**온라인 업데이트**: `update()` 호출 시 세 분류기 전체 재초기화 → 새 응답 즉시 반영

**추천 결과 스키마**
```python
[
  {
    "question_id": 42,
    "category":    "Deep Learning",
    "subcategory": "CNN",
    "difficulty":  "junior_level",
    "question":    "...",
    "choices":     ["A", "B", "C", "D"],
    "scores": {
      "GKT":   0.750,
      "SAKT":  0.333,
      "DKT":   0.500,
      "total": 0.544   # 내림차순 정렬 기준
    }
  },
  ...
]
```

---

## WHEN — 일정 및 현재 상태

### 구현 완료
| 항목 | 상태 |
|------|------|
| SeedQuiz (샘플링·채점·세션 직렬화) | ✅ 완료 |
| Voting (구간 판별·업데이트) | ✅ 완료 |
| GKT (그래프 취약점 전파) | ✅ 완료 |
| SAKT (attention window=10) | ✅ 완료 |
| DKT (카테고리 정답률) | ✅ 완료 |
| Recommend (소프트 보팅·재초기화) | ✅ 완료 |
| 통합 테스트 (`test.py`) | ✅ 완료 |
| AI_Engineer 직군 데이터 검증 | ✅ 완료 |

### 미완료 항목 (우선순위 순)
| 우선순위 | 항목 | 담당 |
|----------|------|------|
| P0 | Django View 연동 (DB 데이터 주입·API 엔드포인트) | 백엔드 팀 |
| P0 | 퀴즈 세션 저장 방식 결정 (Django session vs Redis) | 백엔드 팀 |
| P0 | 추천 결과 `problem_recommendations` 테이블 저장 | 백엔드 팀 |
| P1 | 30개 전체 직군 end-to-end 검증 | ML 팀 |
| P1 | 풀이 이력 누적에 따른 추천 품질 평가 지표 수립 | ML 팀 |
| P2 | GKT 신경망 기반 고도화 (현재 규칙 기반) | ML 팀 |
| P2 | SAKT window 크기 최적화 실험 | ML 팀 |
| P2 | 구간 경계값 (60/77%) A/B 테스트 | ML 팀 |

---

## WHERE — 범위 및 시스템 경계

### 파일 위치
```
models/curriculum/
├── seedquiz.py          # 진단 퀴즈
├── voting.py            # 구간 판별
├── recommend.py         # 소프트 보팅
├── curriculum_builder.py # LearningPaths 빌드 타임 생성 (런타임 제외)
├── test.py              # 통합 테스트
└── ml/
    ├── gkt.py
    ├── sakt.py
    └── dkt.py
```

### 의존 데이터 (DB에서 주입)
| 데이터 | 출처 테이블 | 형태 |
|--------|------------|------|
| 문제 데이터 | `job_problems` | `{question_id: problem_dict}` |
| 학습 순서 | `learning_path_meta.ordered_path` | `list[int]` |
| 선수과목 그래프 | `learning_path_meta.dependency_graph` | `{"nodes": [...], "edges": [...]}` |
| 풀이 이력 저장 | `job_problem_solve_history` | Django ORM (백엔드에서 처리) |
| 추천 결과 저장 | `problem_recommendations` | Django ORM (백엔드에서 처리) |

### 모듈 경계 원칙
- 이 모듈은 Django ORM을 **직접 import하지 않는다**
- DB 읽기·쓰기는 **백엔드 View가 전담**하고, 모듈에는 Python 기본 자료형만 전달
- 세션 직렬화(`export_session`)는 JSON 직렬 가능한 dict만 반환 → 저장 위치는 백엔드가 결정

---

## WHY — 목적 및 비즈니스 가치

### 해결하는 핵심 문제

**1. 획일적 학습 콘텐츠의 한계**
모든 학습자에게 동일한 순서로 문제를 제공하면, 이미 아는 내용을 반복하거나 너무 어려운 문제에 좌절하는 양극화가 발생한다. 진단 퀴즈로 현재 수준을 파악하고 개인 맞춤 문제를 제공해 학습 효율을 극대화한다.

**2. 약점 파악의 어려움**
단순 정답률로는 어떤 개념이 부족한지 알 수 없다. GKT의 선수과목 그래프 전파로 "틀린 이유"가 되는 선행 지식 약점까지 탐지한다.

**3. 학습 지속성 부족**
어려운 문제만 추천하면 좌절감으로 이탈한다. DKT가 "잘 풀 수 있는 문제"에도 가중치를 두어 성취감을 유지하고, SAKT가 최근 학습 흐름의 연속성을 보장한다.

### 앙상블 설계 근거

단일 모델은 한 가지 신호만 본다:
- GKT만 사용: 취약점만 추천 → 좌절, 학습 흐름 단절
- SAKT만 사용: 최근 공부한 것만 반복 → 새 영역 미탐색
- DKT만 사용: 쉬운 문제만 추천 → 성장 정체

세 모델의 소프트 보팅이 **취약점 보완 + 학습 연속성 + 성취감**을 동시에 최적화한다.

### GKT 가중치가 수준에 따라 증가하는 이유
수준이 높을수록 아직 경험하지 않은 고급 개념의 선수 취약점을 **선제적으로** 파악하는 것이 더 중요하다. 낮은 수준에서는 성취감 유지(DKT)가 이탈 방지에 더 효과적이므로 DKT 가중치를 높게 유지한다.

---

## HOW — 구현 방법 및 기술 제약

### Django 연동 표준 패턴 (미구현 — 설계 기준)

```python
# backend/core/views.py
from models.curriculum.seedquiz  import SeedQuiz
from models.curriculum.voting    import Voting
from models.curriculum.recommend import Recommend

class QuizStartView(APIView):
    def post(self, request):
        job_role = request.data['job_role']
        problems = {
            p.original_question_id: {
                "question_id":    p.original_question_id,
                "difficulty":     p.difficulty,
                "category":       p.category,
                "subcategory":    p.subcategory,
                "question":       p.question,
                "choices":        p.choices,
                "correct_answer": p.correct_answer,
                "explanation":    p.explanation,
            }
            for p in JobProblem.objects.filter(job_role=job_role)
        }
        meta = LearningPathMeta.objects.get(job_role=job_role)
        quiz = SeedQuiz(str(request.user.id), problems, meta.ordered_path)
        request.session['quiz']             = quiz.export_session()
        request.session['problems']         = problems
        request.session['dependency_graph'] = meta.dependency_graph
        return Response({'questions': quiz.get_all_questions()})

class QuizSubmitView(APIView):
    def post(self, request):
        quiz = SeedQuiz(str(request.user.id),
                        request.session['problems'],
                        request.session.get('ordered_path', []))
        quiz.import_session(request.session['quiz'])
        result = quiz.submit(request.data['index'], request.data['answer'])
        request.session['quiz'] = quiz.export_session()
        return Response(result)

class RecommendView(APIView):
    def get(self, request):
        quiz = SeedQuiz(...)
        quiz.import_session(request.session['quiz'])
        result  = quiz.get_result()
        voting  = Voting(result)
        rec     = Recommend(
            voting.get_status(),
            request.session['problems'],
            result['responses'],
            request.session['dependency_graph']
        )
        recs = rec.get_recommendations(top_n=5)
        # ProblemRecommendation.objects.bulk_create([...]) — 추천 결과 저장
        return Response({'recommendations': recs})
```

### 세션 관리 옵션
| 방식 | 장점 | 단점 |
|------|------|------|
| Django 기본 세션 (DB) | 구현 단순, 추가 인프라 불필요 | 대규모 동시접속 시 DB 부하 |
| Redis 세션 | 빠른 I/O, TTL 자동 관리 | Redis 서버 추가 필요 |
| JWT Payload 임베딩 | Stateless | 페이로드 크기 제한, 보안 노출 위험 |

### 테스트 실행 및 커버리지

```bash
cd models/curriculum
python test.py
# 검증 항목 (29개):
# - SeedQuiz: 샘플링 정확도(5), 채점(3), 이어풀기(1)
# - Voting: 구간 판별(4), 업데이트(1), get_status 키(1)
# - GKT/SAKT/DKT: 점수 범위(3), 엣지 케이스(2)
# - Recommend: 반환 수(1), 중복 제외(1), 정렬(1), 업데이트(3)
# - 전체 파이프라인: 구간 전환(2), 추천 수(1)
```

### 코드 수정 시 주의사항
1. **`DIFFICULTY_CONFIG` 변경**: `test.py` 샘플링 검증 항목도 동반 수정
2. **`ZONE_LOW / ZONE_MID` 변경**: 가중치 표 전체 재검토 필요
3. **`predict()` 시그니처 변경**: `Recommend._soft_voting_score()` 내 루프도 동반 수정
4. **`update()` 호출 순서**: `Voting.update()` → `Recommend.update()` 순서 보장
5. **`dependency_graph` 구조 변경**: `GKT._build_weak_nodes()`의 `Preceding_ID` / `Target_ID` 키 확인
