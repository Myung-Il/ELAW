# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 역할

`curriculum/`은 ELAW의 **개인화 문제 추천 파이프라인**이다. Django ORM을 직접 import하지 않는 순수 Python 모듈로, 백엔드 View가 DB 데이터를 Python dict/list로 주입하면 추천 결과를 반환한다.

## 파일 구성

| 파일 | 클래스 | 역할 |
|------|--------|------|
| `seedquiz.py` | `SeedQuiz` | 10문제 진단 퀴즈 출제·채점·세션 관리 |
| `voting.py` | `Voting` | 정답률 → 구간 판별 → 모델 가중치 결정 |
| `recommend.py` | `Recommend` | GKT+SAKT+DKT 소프트 보팅 → Top-N 추천 |
| `ml/gkt.py` | `GKT` | 그래프 기반 미래 취약점 예측 |
| `ml/sakt.py` | `SAKT` | 최근 응답 패턴 기반 연관성 점수 |
| `ml/dkt.py` | `DKT` | 카테고리 정답률 기반 예상 확률 |
| `curriculum_builder.py` | — | LearningPaths JSON 사전 생성 (빌드 타임 전용) |
| `test.py` | — | 전체 파이프라인 end-to-end 통합 테스트 |

## 파이프라인 흐름

```
[Django View] DB에서 problems dict + ordered_path + dependency_graph 주입
        ↓
[SeedQuiz]   10문제 샘플링 (university×5, junior×3, middle×2, senior 제외)
             ordered_path 앞쪽 우선 (선수 개념 먼저)
        ↓
[Voting]     정답률 → zone → {GKT, SAKT, DKT} 가중치
        ↓
[Recommend]  후보 문제별 소프트 보팅 → total 점수 내림차순 Top-N
        ↓
[update()]   문제 풀이 결과 반영 → 분류기 재초기화 → 반복
```

## 각 모듈 사용법

### SeedQuiz

```python
quiz = SeedQuiz(username, problems, ordered_path)
# problems: {question_id: {difficulty, category, subcategory, question, choices, correct_answer, explanation}}
# ordered_path: [question_id, ...] (선수과목 순서 정렬된 ID 리스트)

quiz.get_all_questions()       # → list[dict] (10문제, correct_answer 미포함)
quiz.get_question(index)       # → dict (단건)
quiz.submit(index, answer)     # → {is_correct, correct_answer, explanation}
quiz.get_progress()            # → {answered, total, correct, accuracy%, is_completed}
quiz.get_result()              # → {username, total, correct, accuracy, responses[]}
quiz.export_session()          # → dict (직렬화, Django session 저장용)
quiz.import_session(session)   # 저장된 세션 복원 (이어풀기)
```

- `submit()`은 같은 index 재제출 시 덮어쓰기 (수정 허용)
- `get_question()`은 `correct_answer` 미포함 (채점 전 노출 방지)

### Voting

```python
voting = Voting(quiz.get_result())

voting.get_zone()             # "낮음" | "괜찮음" | "높음"
voting.get_weights()          # {"DKT": float, "SAKT": float, "GKT": float}
voting.get_weak_categories()  # {category: 오답률} 내림차순
voting.update(is_correct)     # 문제 풀 때마다 호출 — 누적 정답률 재계산
voting.get_status()           # {accuracy, zone, weights, weak_categories}
```

구간 경계값: `ZONE_LOW = 60.0`, `ZONE_MID = 77.0`

| zone | 정답률 | GKT | SAKT | DKT |
|------|--------|-----|------|-----|
| 낮음 | < 60% | 0.40 | 0.20 | 0.40 |
| 괜찮음 | 60~77% | 0.45 | 0.20 | 0.35 |
| 높음 | ≥ 77% | 0.50 | 0.20 | 0.30 |

### Recommend

```python
rec = Recommend(
    status=voting.get_status(),
    problems=problems,                    # 전체 문제 dict
    responses=quiz.get_result()["responses"],
    dependency_graph=path["dependency_graph"]
)
rec.get_recommendations(top_n=5)         # 이미 푼 문제 자동 제외
rec.update(question_id, is_correct, category, subcategory)  # 분류기 재초기화 포함
rec.get_status()                          # {zone, weights, answered_count, remaining_count}
```

`update()` 호출 시 세 분류기 모두 재초기화됨 — 새 응답이 즉시 반영되는 온라인 학습 방식.

## 분류기 상세 (`ml/`)

### GKT (`ml/gkt.py`)
- `_build_node_mastery()`: 카테고리별 `correct/total` → 숙련도 0~1
- `_build_weak_nodes()`: 오답 question_id + 해당 노드의 선행 노드(`Preceding_ID`) 집합
- `predict(problem)`: `(weak_score + (1 - mastery)) / 2`
  - `weak_score = 1.0` if question_id ∈ weak_nodes, else `0.0`
  - 미경험 카테고리 기본 mastery = 0.5

### SAKT (`ml/sakt.py`)
- window 기본값: **10** (최근 10개 응답만 참조)
- attention weight: `(i+1)/n` (최근일수록 선형 증가), 전체 정규화
- `predict(problem)`: 해당 카테고리의 attention weight 반환
  - 응답 없으면 `0.0` 반환

### DKT (`ml/dkt.py`)
- `_build_category_stats()`: 카테고리별 `{total, correct}` 집계
- `predict(problem)`: `correct/total`
  - 미경험 카테고리 중립값 `0.5` 반환

## 소프트 보팅 공식

```
total_score = w_GKT × GKT.predict(p) + w_SAKT × SAKT.predict(p) + w_DKT × DKT.predict(p)
```

**점수 해석 주의**: 세 모델의 점수 방향이 다름
- GKT: 높을수록 **취약** (추천 우선순위↑)
- SAKT: 높을수록 **최근 활성** 카테고리 (학습 연속성↑)
- DKT: 높을수록 **잘 풀 수 있는** 문제 (성취감↑)

→ 세 신호를 혼합해 취약점 보완 + 학습 흐름 유지 + 성취감을 동시에 고려

## 테스트

```bash
cd models/curriculum
python test.py
# AI_Engineer 직군 데이터로 전체 파이프라인 검증
# DB/JobProblems/AI_Engineer.json + DB/LearningPaths/AI_Engineer_path.json 필요
```

테스트 항목: SeedQuiz 샘플링 정확도, Voting 구간 전환, GKT/SAKT/DKT 점수 범위, Recommend 정렬·제외 로직, 이어풀기 세션 복원

## CurriculumBuilder 사용 시 주의

`curriculum_builder.py`는 런타임에 호출하지 않는다. 실행 시 `DB/LearningPaths/*.json`을 덮어쓰므로, 재실행 후에는 반드시 `python manage.py load_problems --reset`으로 DB 재적재 필요.

## Django 연동 시 데이터 주입 방식

```python
# backend/core/views.py (연동 예정)
problems = {
    p.original_question_id: {
        "question_id":    p.original_question_id,
        "difficulty":     p.difficulty,
        "category":       p.category,
        "subcategory":    p.subcategory,
        "question":       p.question,
        "choices":        p.choices,        # list
        "correct_answer": p.correct_answer,
        "explanation":    p.explanation,
    }
    for p in JobProblem.objects.filter(job_role=job_role)
}
meta             = LearningPathMeta.objects.get(job_role=job_role)
ordered_path     = meta.ordered_path        # list[int]
dependency_graph = meta.dependency_graph    # {"nodes": [...], "edges": [...]}
```
