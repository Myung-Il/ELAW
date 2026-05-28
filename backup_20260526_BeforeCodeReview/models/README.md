# models/

ELAW 플랫폼의 AI/ML 모듈 디렉터리. Django 앱과 **독립된 순수 Python 모듈**로 구성되어 있으며, Django 없이도 단독 실행·테스트가 가능하다.

```
models/
├── curriculum/     # 문제 추천 파이프라인
│   └── ml/         # 지식 추적 분류기 3종
└── portfolio/      # AI 포트폴리오 생성기
```

---

## curriculum/ — 문제 추천 시스템

학습자의 현재 수준을 진단하고, 세 가지 지식 추적 모델의 앙상블로 다음에 풀어야 할 문제를 추천한다.

### 전체 파이프라인

```
[Django] JobProblem × 200문제, LearningPathMeta.ordered_path
        ↓
[SeedQuiz]  10문제 진단 퀴즈 출제 및 응답 수집
        ↓
[Voting]    정답률 → 학습 구간 판별 → 모델 가중치 결정
        ↓
[Recommend] GKT + SAKT + DKT 소프트 보팅 → 상위 N개 문제 추천
        ↓
[update()]  풀이 결과 반영 → 반복 추천 (온라인 업데이트)
```

### 파일별 역할

| 파일 | 역할 |
|------|------|
| `seedquiz.py` | 난이도별 할당량으로 10문제 샘플링, 채점, 세션 직렬화 |
| `voting.py` | 정답률 구간 판별 및 GKT/SAKT/DKT 보팅 가중치 관리 |
| `recommend.py` | 세 분류기 결과를 소프트 보팅으로 집계해 추천 문제 반환 |
| `curriculum_builder.py` | Sentence-BERT 임베딩으로 LearningPaths JSON 사전 생성 (런타임 외) |
| `test.py` | 전체 파이프라인 end-to-end 통합 테스트 |
| `ml/gkt.py` | Graph-based Knowledge Tracing — 선수과목 그래프 기반 미래 취약점 예측 |
| `ml/sakt.py` | Self-Attentive Knowledge Tracing — 최근 응답 패턴 기반 연관성 점수 |
| `ml/dkt.py` | Deep Knowledge Tracing — 카테고리별 정답률 기반 예상 확률 |

### 빠른 시작

```python
# Django View에서 DB 데이터를 주입해 사용
from curriculum.seedquiz import SeedQuiz
from curriculum.voting   import Voting
from curriculum.recommend import Recommend

# 1. DB에서 데이터 조회 (Django ORM)
problems     = {p.original_question_id: vars(p)
                for p in JobProblem.objects.filter(job_role="Backend Engineer")}
ordered_path = LearningPathMeta.objects.get(job_role="Backend Engineer").ordered_path
dependency_graph = LearningPathMeta.objects.get(job_role="Backend Engineer").dependency_graph

# 2. 진단 퀴즈
quiz = SeedQuiz("홍길동", problems, ordered_path)
# ... 10문제 순환: quiz.get_question(i) → quiz.submit(i, answer) ...
result = quiz.get_result()   # {accuracy%, responses[]}

# 3. 구간 판별
voting = Voting(result)
status = voting.get_status() # {zone, weights, weak_categories}

# 4. 문제 추천
rec = Recommend(status, problems, result["responses"], dependency_graph)
top5 = rec.get_recommendations(top_n=5)

# 5. 문제 풀 때마다 갱신
voting.update(is_correct)
rec.update(question_id, is_correct, category, subcategory)
```

### 보팅 가중치 (Voting)

| 구간 | 정답률 | GKT | SAKT | DKT |
|------|--------|-----|------|-----|
| 낮음 | ~60%   | 0.40 | 0.20 | 0.40 |
| 괜찮음 | 60~77% | 0.45 | 0.20 | 0.35 |
| 높음 | 77%~   | 0.50 | 0.20 | 0.30 |

> 정답률이 높을수록 GKT 비중이 커진다 — 아직 경험하지 않은 취약점을 선제적으로 방어하기 위해서다.

### 세 분류기 비교

| 모델 | 예측 대상 | 높은 점수의 의미 |
|------|----------|----------------|
| **GKT** | 미래 취약 가능성 | 틀린 문제의 선수과목이거나 미숙한 영역 |
| **SAKT** | 최근 학습 연관성 | 최근 많이 풀었던 카테고리와 관련된 문제 |
| **DKT** | 예상 정답 확률 | 해당 카테고리의 과거 정답률이 높은 문제 |

### 테스트 실행

```bash
cd models/curriculum
python test.py
```

### CurriculumBuilder — 학습 경로 사전 생성

`curriculum_builder.py`는 `DB/LearningPaths/` JSON 파일을 **빌드 타임**에 생성하는 스크립트로, 서비스 런타임에는 호출하지 않는다.

- Sentence-BERT(`paraphrase-multilingual-mpnet-base-v2`)로 시나리오·스킬 의미 유사도 계산
- `transformers` 미설치 시 TF-IDF/Jaccard로 자동 폴백
- `combined_score = skill_sim × 0.55 + scenario_sim × 0.45 + (같은 category +0.08)`
- 엣지 생성 조건: `combined_score ≥ 0.2`, 낮은 난이도 → 높은 난이도 방향, 타깃당 최대 선수과목 3개

---

## portfolio/ — AI 포트폴리오 생성기

로컬 Ollama 모델을 사용해 사용자의 경력과 채용공고를 기반으로 포트폴리오 본문을 자동 생성한다.

자세한 사용법은 [portfolio/README.md](portfolio/README.md)를 참고한다.

---

## Django 백엔드 연동

- `curriculum/` 모듈: `backend/core/views.py`(예정)에서 DB 데이터를 주입해 호출
- `portfolio/` 모듈: `backend/jobs/portfolio_ai.py`에서 `subprocess`로 호출
- 두 모듈 모두 Django ORM을 직접 import하지 않으므로 단독 테스트 가능
