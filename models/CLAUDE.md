# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 역할

`models/` 폴더는 Django 앱과 독립된 **순수 Python ML 모듈**이다. Django 의존성 없이 CLI·라이브러리로 직접 사용 가능하다.

```
models/
├── curriculum/     # 문제 추천 파이프라인 (SeedQuiz → Voting → Recommend)
│   └── ml/         # 개별 지식 추적 모델 (GKT, SAKT, DKT)
└── portfolio/      # Ollama 기반 포트폴리오 생성
```

## 문제 추천 파이프라인 (`curriculum/`)

### 전체 흐름

```
[DB] JobProblem × 200, LearningPathMeta.ordered_path
        ↓
[SeedQuiz]  10문제 진단 (university×5, junior×3, middle×2)
        ↓
[Voting]    정답률 → zone → 모델 가중치 결정
        ↓
[Recommend] GKT + SAKT + DKT 소프트 보팅 → Top-N 추천
        ↓
[update()]  풀이 결과 반영 → 온라인 업데이트
```

### SeedQuiz (`seedquiz.py`)

```python
quiz = SeedQuiz(username, problems_dict, ordered_path)
quiz.get_all_questions()           # 10문제 반환
quiz.submit(index, answer)         # 단건 채점
quiz.get_result()                  # → {accuracy%, responses[]}
quiz.export_session() / import_session()  # 세션 직렬화/복원
```

`ordered_path` 순서대로 순회하며 난이도별 할당량 채워 10문제 샘플링. Senior 문제는 진단에서 제외.

### Voting (`voting.py`)

| 정답률 | Zone | DKT | SAKT | GKT |
|--------|------|-----|------|-----|
| < 60% | 낮음 | 0.40 | 0.20 | 0.40 |
| 60–77% | 괜찮음 | 0.35 | 0.20 | 0.45 |
| ≥ 77% | 높음 | 0.30 | 0.20 | 0.50 |

```python
v = Voting(quiz_result)     # quiz.get_result() 전달
v.get_zone()                # "낮음" | "괜찮음" | "높음"
v.get_weights()             # {DKT, SAKT, GKT}
v.get_weak_categories()     # 오답률 높은 카테고리 dict
v.update(is_correct)        # 풀이 후 점수 재계산
```

### 세 가지 분류기 (`ml/`)

| 모델 | 예측 대상 | 핵심 로직 |
|------|----------|----------|
| **GKT** (`gkt.py`) | 미래 취약점 | 오답 노드 + 선수과목 전파 → `(weak_score + 1-mastery) / 2` |
| **SAKT** (`sakt.py`) | 최근 학습 패턴 | 최근 N=10 응답의 카테고리별 attention weight (recency bias) |
| **DKT** (`dkt.py`) | 정답 확률 | 카테고리별 `correct / total` (미경험 카테고리 기본값 0.5) |

출력: 모두 float 0.0~1.0 (높을수록 해당 문제를 추천)

### Recommend (`recommend.py`)

```python
rec = Recommend(
    status=voting.get_status(),          # zone, weights, weak_categories
    problems=problems_dict,
    responses=quiz_result['responses'],
    dependency_graph=learning_path['dependency_graph']
)
rec.get_recommendations(top_n=5)
# → [{question_id, category, difficulty, question, choices,
#     scores: {GKT, SAKT, DKT, total}}]

rec.update(question_id, is_correct, category, subcategory)  # 풀이 후 반영
```

소프트 보팅: `total = w_GKT × gkt + w_SAKT × sakt + w_DKT × dkt`  
이미 푼 문제는 후보에서 제외.

### CurriculumBuilder (`curriculum_builder.py`)

DB의 `LearningPaths/` JSON을 **사전 생성**하는 스크립트. 런타임에 호출하지 않는다.

- Sentence-BERT (`paraphrase-multilingual-mpnet-base-v2`) 임베딩으로 시나리오·스킬 유사도 계산
- `transformers` 미설치 시 TF-IDF/Jaccard로 자동 폴백
- `combined_score = skill_sim × 0.55 + scenario_sim × 0.45 + (same_category ? 0.08 : 0)`
- 선수과목 엣지 조건: `combined_score ≥ 0.2`, 난이도 낮은→높은 방향, 타깃당 최대 3개

## 포트폴리오 생성 (`portfolio/`)

```
portfolio/
├── portfolio_maker.py        # Ollama 호출 래퍼
├── Modelfile                 # Ollama 모델 정의
└── my_portfolio_adapter.gguf # LoRA 파인튜닝 가중치
```

### 실행 방식

```python
# portfolio_maker.py 내부
subprocess.run(['ollama', 'run', 'mybot', prompt], capture_output=True)
```

- Ollama 로컬 설치 및 `mybot` 모델 필요 (`ollama list | grep mybot`)
- 입력: 사용자 경력 서술 + 채용공고 JD
- 출력: 한국어 포트폴리오 본문 (조작·허구 금지 프롬프트 포함)
- Django에서는 `jobs/portfolio_ai.py`가 이 모듈을 subprocess로 호출

## Django 연동 인터페이스

```python
# Django view에서의 예상 호출 패턴
problems = {p.question_id: p.__dict__ for p in JobProblem.objects.filter(job_role=role)}
ordered_path = LearningPathMeta.objects.get(job_role=role).ordered_path

quiz = SeedQuiz(request.user.username, problems, ordered_path)
# 세션에 quiz.export_session() 저장 후 라운드트립

result = quiz.get_result()
voting = Voting(result)
rec = Recommend(voting.get_status(), problems, result['responses'],
                learning_path_meta.dependency_graph)
recommendations = rec.get_recommendations(top_n=5)
```

## 테스트

```bash
cd models/curriculum
python test.py   # 전체 파이프라인 end-to-end 통합 테스트
```

## 설계 원칙

- **Django 의존성 없음**: 독립 실행 가능, 단위 테스트 용이
- **온라인 업데이트**: `update()` 메서드로 풀이 결과를 즉시 반영
- **세션 직렬화**: `export_session()` / `import_session()`으로 퀴즈 중단·재개 지원
- **GPU 자동 감지**: CUDA 가용 시 자동 사용, CPU 폴백
