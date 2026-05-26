# 문제 추천 시스템 — 모듈 구조 및 흐름

## 전체 흐름

```
[Django View에서 DB 조회]
        ↓
[SeedQuiz] → 시드 10문제 출제 및 응답 수집
        ↓
[Voting]   → 정답률 기반 구간 판별 + 보팅 비율 계산
        ↓
[Recommend] → GKT / SAKT / DKT Soft Voting → 문제 추천
```

---

## 파일 구조

```
models/
├── SeedQuiz.py           # 시드 퀴즈
├── voting.py             # 구간 판별 및 가중치
├── recommend.py          # Soft Voting 추천
├── curriculum_builder.py # LearningPath 생성 파이프라인
├── test.py               # 전체 테스트
└── ml/
    ├── gkt.py            # Graph-based Knowledge Tracing
    ├── sakt.py           # Self-Attentive Knowledge Tracing
    └── dkt.py            # Deep Knowledge Tracing
```

---

## 1. SeedQuiz

Django View에서 DB 데이터를 받아 시드 10문제를 출제하고 응답을 수집한다.

**시드 문제 구성 기준**
- ordered_path 앞쪽 우선 (선행 개념 먼저)
- university_level 5개 / junior_level 3개 / middle_level 2개
- senior_level 제외

```python
# Django View에서 DB 조회 후 주입
problems     = {p.question_id: p for p in JobProblem.objects.filter(job_role=job_role)}
ordered_path = LearningPathMeta.objects.get(job_role=job_role).ordered_path

quiz = SeedQuiz(username, problems, ordered_path)

quiz.get_question(0)        # 특정 문제 조회
quiz.get_all_questions()    # 전체 목록 조회
quiz.submit(0, "Recall")    # 답 제출
quiz.get_progress()         # 진행 상태
quiz.export_session()       # 세션 저장 (이어풀기)
quiz.import_session(session)# 세션 복원 (이어풀기)
quiz.get_result()           # 최종 결과 → Voting으로 전달
```

---

## 2. Voting

SeedQuiz 결과를 받아 구간을 판별하고 보팅 비율을 관리한다.

**구간 기준 (수능 등급제 참고)**

| 구간 | 정답률 | DKT | SAKT | GKT |
|------|--------|-----|------|-----|
| 낮음 | ~60%   | 0.4 | 0.2  | 0.4 |
| 괜찮음 | 60~77% | 0.35 | 0.2 | 0.45 |
| 높음 | 77%~   | 0.3 | 0.2  | 0.5  |

```python
voting = Voting(quiz.get_result())

voting.get_zone()            # 구간 반환
voting.get_weights()         # 보팅 비율 반환
voting.get_weak_categories() # 카테고리별 취약점
voting.update(is_correct)    # 매 문제마다 누적 정답률 재계산
voting.get_status()          # 전체 상태 → Recommend로 전달
```

---

## 3. ml/ — 분류기 3개

배운 구조처럼 분류기를 독립 클래스로 만들고 Soft Voting으로 묶는다.

```python
# 분류기 지정
classifiers = [
    ("GKT",  GKT(responses, dependency_graph)),  # 미래 취약 가능성
    ("SAKT", SAKT(responses)),                    # 과거 패턴 연관성
    ("DKT",  DKT(responses))                      # 예상 정답 확률
]

# 각 분류기가 문제별 점수를 반환
for name, clf in classifiers:
    score = clf.predict(problem)  # 0~1 사이 점수
```

**각 모델 역할**

- GKT: dependency_graph 위에서 틀린 노드와 선행 노드를 취약점으로 마킹 → 미래 취약 가능성 점수
- SAKT: 최근 응답 시퀀스에서 현재 문제와의 연관성을 가중치로 계산 → 과거 패턴 연관성 점수
- DKT: 카테고리별 정답률 기반으로 이 문제를 맞출 확률 → 예상 정답 확률

---

## 4. Recommend

세 모델의 점수를 Voting 비율로 가중합(Soft Voting)해서 최종 추천 문제를 선정한다.

```python
recommend = Recommend(status, problems, responses, dependency_graph)

# Soft Voting 흐름
# total = GKT비율 × GKT점수 + SAKT비율 × SAKT점수 + DKT비율 × DKT점수

recommend.get_recommendations(top_n=5)                              # 추천 문제 반환
recommend.update(question_id, is_correct, category, subcategory)    # 문제 풀 때마다 갱신
recommend.get_status()                                              # 현재 상태 반환
```

---

## 전체 사용 예시

```python
# 1. 시드 퀴즈
quiz = SeedQuiz(username, problems, ordered_path)
# ... 10문제 풀기 ...
result = quiz.get_result()

# 2. 구간 판별
voting = Voting(result)
status = voting.get_status()

# 3. 문제 추천
recommend = Recommend(status, problems, result["responses"], dependency_graph)
recs = recommend.get_recommendations(top_n=5)

# 4. 매 문제마다
voting.update(is_correct)
recommend.update(question_id, is_correct, category, subcategory)
```