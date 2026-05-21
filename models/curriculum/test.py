import json
import sys
from pathlib import Path

# models/ 폴더 기준으로 경로 설정
BASE_DIR = Path(__file__).resolve().parent
DB_DIR   = BASE_DIR.parent.parent / "DB"
sys.path.insert(0, str(BASE_DIR))

from seedquiz import SeedQuiz
from voting import Voting
from recommend import Recommend
from ml.gkt import GKT
from ml.sakt import SAKT
from ml.dkt import DKT

# ─────────────────────────────────────────
# 테스트 데이터 로드 (Django View 역할)
# ─────────────────────────────────────────
with open(DB_DIR / "JobProblems" / "AI_Engineer.json", encoding="utf-8") as f:
    raw = json.load(f)
with open(DB_DIR / "LearningPaths" / "AI_Engineer_path.json", encoding="utf-8") as f:
    path = json.load(f)

problems          = {p['question_id']: p for p in raw}
ordered_path      = path['ordered_path']
dependency_graph  = path['dependency_graph']

PASS = "✓ PASS"
FAIL = "✗ FAIL"

def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")

def check(label, condition):
    print(f"  {'✓' if condition else '✗'} {label}")
    return condition

results = []

# ─────────────────────────────────────────
# 1. SeedQuiz
# ─────────────────────────────────────────
section("1. SeedQuiz")

quiz = SeedQuiz('홍길동', problems, ordered_path)
questions = quiz.get_all_questions()

results.append(check("전체 문제 수 10개", len(questions) == 10))
results.append(check("university 5개", sum(1 for q in questions if q['difficulty'] == 'university_level') == 5))
results.append(check("junior 3개",     sum(1 for q in questions if q['difficulty'] == 'junior_level') == 3))
results.append(check("middle 2개",     sum(1 for q in questions if q['difficulty'] == 'middle_level') == 2))
results.append(check("senior 없음",    sum(1 for q in questions if q['difficulty'] == 'senior_level') == 0))

# 정답 4개, 오답 6개 제출
for i, q in enumerate(questions):
    correct = problems[q['question_id']]['correct_answer']
    if i < 4:
        answer = correct
    else:
        answer = next(c for c in q['choices'] if c != correct)
    quiz.submit(i, answer)

progress = quiz.get_progress()
results.append(check("정답 4개 기록",       progress['correct'] == 4))
results.append(check("완료 상태",           progress['is_completed']))
results.append(check("정답률 40.0%",        abs(progress['accuracy'] - 40.0) < 0.01))

# 이어풀기
session = quiz.export_session()
quiz2   = SeedQuiz('홍길동', problems, ordered_path)
quiz2.import_session(session)
results.append(check("이어풀기 응답 수 유지", quiz2.get_progress()['answered'] == 10))

# ─────────────────────────────────────────
# 2. Voting
# ─────────────────────────────────────────
section("2. Voting")

result = quiz.get_result()
voting = Voting(result)

results.append(check("정답률 40% → 낮음 구간",   voting.get_zone() == "낮음"))
results.append(check("낮음 DKT 비율 0.4",        voting.get_weights()['DKT'] == 0.4))
results.append(check("낮음 SAKT 비율 0.2",       voting.get_weights()['SAKT'] == 0.2))
results.append(check("낮음 GKT 비율 0.4",        voting.get_weights()['GKT'] == 0.4))
results.append(check("취약 카테고리 존재",         len(voting.get_weak_categories()) > 0))

# 업데이트 — 정답 계속 맞혀서 높음 구간으로
for _ in range(30):
    voting.update(True)
results.append(check("누적 후 높음 구간 진입",    voting.get_zone() == "높음"))

status = voting.get_status()
results.append(check("get_status 반환 키 확인",
    all(k in status for k in ['accuracy', 'zone', 'weights', 'weak_categories'])))

# ─────────────────────────────────────────
# 3. GKT / SAKT / DKT 개별
# ─────────────────────────────────────────
section("3. GKT / SAKT / DKT 개별")

responses = result['responses']
sample_p  = problems[questions[0]['question_id']]

gkt  = GKT(responses, dependency_graph)
sakt = SAKT(responses)
dkt  = DKT(responses)

gkt_score  = gkt.predict(sample_p)
sakt_score = sakt.predict(sample_p)
dkt_score  = dkt.predict(sample_p)

results.append(check("GKT 점수 0~1 범위",  0.0 <= gkt_score  <= 1.0))
results.append(check("SAKT 점수 0~1 범위", 0.0 <= sakt_score <= 1.0))
results.append(check("DKT 점수 0~1 범위",  0.0 <= dkt_score  <= 1.0))

# 응답 없을 때 SAKT
sakt_empty = SAKT([])
results.append(check("SAKT 빈 응답 → 0.0", sakt_empty.predict(sample_p) == 0.0))

# 응답 없을 때 DKT
dkt_empty = DKT([])
results.append(check("DKT 빈 응답 → 중립값 0.5", dkt_empty.predict(sample_p) == 0.5))

# ─────────────────────────────────────────
# 4. Recommend
# ─────────────────────────────────────────
section("4. Recommend")

# voting 재초기화 (40% 정답률 상태)
voting2 = Voting(result)
status2 = voting2.get_status()

recommend = Recommend(status2, problems, result['responses'], dependency_graph)

recs = recommend.get_recommendations(top_n=5)
results.append(check("추천 문제 5개 반환",          len(recs) == 5))
results.append(check("이미 푼 문제 제외",
    all(r['question_id'] not in {q['question_id'] for q in questions} for r in recs)))
results.append(check("scores 키 존재",
    all('scores' in r for r in recs)))
results.append(check("total 점수 내림차순 정렬",
    all(recs[i]['scores']['total'] >= recs[i+1]['scores']['total'] for i in range(len(recs)-1))))

# 업데이트 후 재추천
rec = recs[0]
recommend.update(rec['question_id'], True, rec['category'], rec['subcategory'])
recs2 = recommend.get_recommendations(top_n=5)
results.append(check("업데이트 후 푼 문제 제외",
    all(r['question_id'] != rec['question_id'] for r in recs2)))

rec_status = recommend.get_status()
results.append(check("answered_count 11",  rec_status['answered_count'] == 11))
results.append(check("remaining_count 189", rec_status['remaining_count'] == 189))

# ─────────────────────────────────────────
# 5. 전체 파이프라인
# ─────────────────────────────────────────
section("5. 전체 파이프라인")

quiz3    = SeedQuiz('테스트', problems, ordered_path)
for i, q in enumerate(quiz3.get_all_questions()):
    correct = problems[q['question_id']]['correct_answer']
    quiz3.submit(i, correct)  # 전부 정답

result3  = quiz3.get_result()
voting3  = Voting(result3)
status3  = voting3.get_status()
rec3     = Recommend(status3, problems, result3['responses'], dependency_graph)
recs3    = rec3.get_recommendations(top_n=5)

results.append(check("전부 정답 → 높음 구간",    voting3.get_zone() == "높음"))
results.append(check("높음 GKT 비율 0.5",        voting3.get_weights()['GKT'] == 0.5))
results.append(check("파이프라인 추천 5개",       len(recs3) == 5))

# ─────────────────────────────────────────
# 최종 결과
# ─────────────────────────────────────────
section("최종 결과")
passed = sum(results)
total  = len(results)
print(f"\n  {passed}/{total} 통과 ({'100%' if passed == total else f'{passed/total*100:.1f}%'})")
if passed == total:
    print(f"\n  {PASS} 전체 테스트 통과")
else:
    print(f"\n  {FAIL} 일부 테스트 실패")