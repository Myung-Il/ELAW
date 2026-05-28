import json
import sys
import random
from pathlib import Path
from collections import Counter

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
# 테스트 데이터 로드
# ─────────────────────────────────────────
with open(DB_DIR / "JobProblems" / "AI_Engineer.json", encoding="utf-8") as f:
    raw = json.load(f)
with open(DB_DIR / "LearningPaths" / "AI_Engineer_path.json", encoding="utf-8") as f:
    path = json.load(f)

problems         = {p['question_id']: p for p in raw}
ordered_path     = path['ordered_path']
dependency_graph = path['dependency_graph']
problem_list     = list(problems.values())

random.seed(42)

def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")

def check(label, condition, detail=None):
    tag = '✓' if condition else '✗'
    extra = f"\n       → {detail}" if detail else ""
    print(f"  {tag} {label}{extra}")
    return condition

def make_status(accuracy, responses):
    result = {
        "total":     len(responses),
        "correct":   int(len(responses) * accuracy / 100),
        "accuracy":  accuracy,
        "responses": responses
    }
    return Voting(result).get_status()

results = []

# ─────────────────────────────────────────
# 1. GKT — 취약 카테고리가 상위 추천되는지
# ─────────────────────────────────────────
section("1. GKT — 취약 카테고리 상위 추천")

# 특정 카테고리만 전부 틀린 응답 구성
all_cats = list({p['category'] for p in problem_list})

# 취약 카테고리: seed(2개) + update(5개) + 후보 최소 1개 = 8개 이상 필요
from collections import Counter
cat_counts = Counter(p['category'] for p in problem_list)
weak_cat = max(cat_counts, key=lambda c: cat_counts[c])  # 문제 수 가장 많은 카테고리

# 카테고리별로 균등하게 뽑아 weak_cat이 반드시 포함되도록 구성
def sample_by_category(problem_list, per_cat=2):
    """카테고리별 per_cat개씩 샘플링"""
    from collections import defaultdict
    buckets = defaultdict(list)
    for p in problem_list:
        buckets[p['category']].append(p)
    result = []
    for cat, ps in buckets.items():
        result.extend(ps[:per_cat])
    return result

responses_gkt = []
for p in sample_by_category(problem_list, per_cat=2):
    is_correct = False if p['category'] == weak_cat else True
    responses_gkt.append({
        "question_id": p['question_id'],
        "category":    p['category'],
        "subcategory": p['subcategory'],
        "is_correct":  is_correct
    })

gkt = GKT(responses_gkt, dependency_graph)
answered_ids = {r['question_id'] for r in responses_gkt}
candidates = [p for p in problem_list if p['question_id'] not in answered_ids]

# 취약 카테고리 문제 vs 나머지 평균 점수 비교
weak_scores  = [gkt.predict(p) for p in candidates if p['category'] == weak_cat]
other_scores = [gkt.predict(p) for p in candidates if p['category'] != weak_cat]

avg_weak  = sum(weak_scores)  / len(weak_scores)  if weak_scores  else 0
avg_other = sum(other_scores) / len(other_scores) if other_scores else 0

results.append(check(
    f"취약 카테고리({weak_cat}) 평균 GKT 점수 > 나머지 평균",
    avg_weak > avg_other,
    f"취약 카테고리 평균: {avg_weak:.3f}  /  나머지 평균: {avg_other:.3f}"
))

# 상위 10개 추천 중 취약 카테고리 비율
scored = sorted(candidates, key=lambda p: gkt.predict(p), reverse=True)
top10_weak_count = sum(1 for p in scored[:10] if p['category'] == weak_cat)
results.append(check(
    "상위 10개 추천 중 취약 카테고리 포함",
    top10_weak_count > 0,
    f"상위 10개 중 취약 카테고리 {top10_weak_count}개"
))

# ─────────────────────────────────────────
# 2. GKT — 선행 노드 취약 마킹이 추천에 반영되는지
# ─────────────────────────────────────────
section("2. GKT — 선행 노드 취약 마킹 추천 반영")

edges = dependency_graph.get("edges", [])
if edges:
    # Target_ID를 틀렸을 때 Preceding_ID가 높은 점수를 받는지
    edge       = edges[0]
    target_id  = edge["Target_ID"]
    preceding_id = edge["Preceding_ID"]

    wrong_response = [{
        "question_id": target_id,
        "category":    problems[target_id]['category'] if target_id in problems else "test",
        "subcategory": "test",
        "is_correct":  False
    }]
    correct_response = [{
        "question_id": target_id,
        "category":    problems[target_id]['category'] if target_id in problems else "test",
        "subcategory": "test",
        "is_correct":  True
    }]

    gkt_wrong   = GKT(wrong_response,   dependency_graph)
    gkt_correct = GKT(correct_response, dependency_graph)

    if preceding_id in problems:
        p_preceding = problems[preceding_id]
        score_when_wrong   = gkt_wrong.predict(p_preceding)
        score_when_correct = gkt_correct.predict(p_preceding)

        results.append(check(
            "Target 틀렸을 때 Preceding 점수 > 맞혔을 때",
            score_when_wrong > score_when_correct,
            f"틀림: {score_when_wrong:.3f}  /  맞힘: {score_when_correct:.3f}"
        ))
    else:
        print("  - preceding_id가 problems에 없어 스킵")
else:
    print("  - 엣지 없어 스킵")

# ─────────────────────────────────────────
# 3. SAKT — 최근에 푼 카테고리가 상위 추천되는지
# ─────────────────────────────────────────
section("3. SAKT — 최근 카테고리 연관 추천")

recent_cat = all_cats[1] if len(all_cats) > 1 else all_cats[0]

# 최근 5개를 특정 카테고리로 채운 응답
responses_sakt = (
    [{"question_id": i, "category": all_cats[2] if len(all_cats) > 2 else all_cats[0],
      "subcategory": "x", "is_correct": True} for i in range(10)] +
    [{"question_id": i+100, "category": recent_cat,
      "subcategory": "x", "is_correct": True} for i in range(5)]
)

sakt = SAKT(responses_sakt)
answered_ids_sakt = {r['question_id'] for r in responses_sakt}
candidates_sakt = [p for p in problem_list if p['question_id'] not in answered_ids_sakt]

recent_scores = [sakt.predict(p) for p in candidates_sakt if p['category'] == recent_cat]
other_scores_sakt = [sakt.predict(p) for p in candidates_sakt if p['category'] != recent_cat]

avg_recent = sum(recent_scores) / len(recent_scores)       if recent_scores      else 0
avg_other_sakt = sum(other_scores_sakt) / len(other_scores_sakt) if other_scores_sakt else 0

results.append(check(
    f"최근 카테고리({recent_cat}) 평균 SAKT 점수 > 나머지 평균",
    avg_recent > avg_other_sakt,
    f"최근 카테고리 평균: {avg_recent:.3f}  /  나머지 평균: {avg_other_sakt:.3f}"
))

# 오래된 카테고리보다 최근 카테고리 점수가 높은지
old_cat = all_cats[2] if len(all_cats) > 2 else all_cats[0]
old_scores = [sakt.predict(p) for p in candidates_sakt if p['category'] == old_cat]
avg_old = sum(old_scores) / len(old_scores) if old_scores else 0

results.append(check(
    "최근 카테고리 점수 > 오래된 카테고리 점수",
    avg_recent > avg_old,
    f"최근: {avg_recent:.3f}  /  오래된: {avg_old:.3f}"
))

# ─────────────────────────────────────────
# 4. DKT — 향상 추세 카테고리가 높은 점수를 받는지
# ─────────────────────────────────────────
section("4. DKT — 향상/하락 추세 점수 반영")

improving_cat = all_cats[0]
declining_cat = all_cats[1] if len(all_cats) > 1 else all_cats[0]

# 향상 추세: 앞에 틀리고 최근에 맞음
# 하락 추세: 앞에 맞고 최근에 틀림
responses_dkt = (
    [{"question_id": i,     "category": improving_cat, "subcategory": "x", "is_correct": False} for i in range(5)] +
    [{"question_id": i+100, "category": improving_cat, "subcategory": "x", "is_correct": True}  for i in range(5)] +
    [{"question_id": i+200, "category": declining_cat, "subcategory": "x", "is_correct": True}  for i in range(5)] +
    [{"question_id": i+300, "category": declining_cat, "subcategory": "x", "is_correct": False} for i in range(5)]
)

dkt = DKT(responses_dkt)
answered_ids_dkt = {r['question_id'] for r in responses_dkt}
candidates_dkt = [p for p in problem_list if p['question_id'] not in answered_ids_dkt]

improving_scores = [dkt.predict(p) for p in candidates_dkt if p['category'] == improving_cat]
declining_scores = [dkt.predict(p) for p in candidates_dkt if p['category'] == declining_cat]

avg_improving = sum(improving_scores) / len(improving_scores) if improving_scores else 0
avg_declining = sum(declining_scores) / len(declining_scores) if declining_scores else 0

results.append(check(
    "향상 추세 카테고리 DKT 점수 > 하락 추세 카테고리",
    avg_improving > avg_declining,
    f"향상: {avg_improving:.3f}  /  하락: {avg_declining:.3f}"
))

# ─────────────────────────────────────────
# 5. Soft Voting — 구간별 추천 경향 확인
# ─────────────────────────────────────────
section("5. Soft Voting — 구간별 추천 경향")

# 시드 퀴즈 결과 구성 (취약 카테고리 = weak_cat) — 카테고리별 균등 샘플링
seed_responses = []
for p in sample_by_category(problem_list, per_cat=2):
    seed_responses.append({
        "question_id": p['question_id'],
        "category":    p['category'],
        "subcategory": p['subcategory'],
        "is_correct":  False if p['category'] == weak_cat else True
    })

answered_seed = {r['question_id'] for r in seed_responses}

# 낮음 구간 (GKT 0.4 / SAKT 0.2 / DKT 0.4)
status_low  = make_status(40.0, seed_responses)
# 괜찮음 구간 (GKT 0.45 / SAKT 0.2 / DKT 0.35)
status_mid  = make_status(65.0, seed_responses)
# 높음 구간 (GKT 0.5 / SAKT 0.2 / DKT 0.3)
status_high = make_status(80.0, seed_responses)

rec_low  = Recommend(status_low,  problems, seed_responses, dependency_graph)
rec_mid  = Recommend(status_mid,  problems, seed_responses, dependency_graph)
rec_high = Recommend(status_high, problems, seed_responses, dependency_graph)

recs_low  = rec_low.get_recommendations(top_n=10)
recs_mid  = rec_mid.get_recommendations(top_n=10)
recs_high = rec_high.get_recommendations(top_n=10)

# 취약 카테고리 포함 비율: 높음 구간(GKT 비율 최대)에서 가장 높아야 함
weak_ratio_low  = sum(1 for r in recs_low  if r['category'] == weak_cat) / len(recs_low)
weak_ratio_mid  = sum(1 for r in recs_mid  if r['category'] == weak_cat) / len(recs_mid)
weak_ratio_high = sum(1 for r in recs_high if r['category'] == weak_cat) / len(recs_high)

print(f"       취약 카테고리 비율 — 낮음: {weak_ratio_low:.2f}  괜찮음: {weak_ratio_mid:.2f}  높음: {weak_ratio_high:.2f}")

results.append(check(
    "높음 구간(GKT 비율 최대)에서 취약 카테고리 추천 비율 가장 높음",
    weak_ratio_high >= weak_ratio_low and weak_ratio_high >= weak_ratio_mid,
    f"낮음: {weak_ratio_low:.2f}  괜찮음: {weak_ratio_mid:.2f}  높음: {weak_ratio_high:.2f}"
))

# GKT 비율이 높을수록 top1 문제의 GKT 점수 기여도가 커야 함
top1_low  = recs_low[0]
top1_high = recs_high[0]

gkt_contrib_low  = status_low['weights']['GKT']  * top1_low['scores']['GKT']
gkt_contrib_high = status_high['weights']['GKT'] * top1_high['scores']['GKT']

results.append(check(
    "높음 구간 top1의 GKT 기여도 ≥ 낮음 구간 top1의 GKT 기여도",
    gkt_contrib_high >= gkt_contrib_low,
    f"낮음: {gkt_contrib_low:.3f}  /  높음: {gkt_contrib_high:.3f}"
))

# ─────────────────────────────────────────
# 6. Recommend — 응답 누적에 따라 추천이 변하는지
# ─────────────────────────────────────────
section("6. Recommend — 응답 누적에 따른 추천 변화")

status_init = make_status(60.0, seed_responses)
rec_evolve  = Recommend(status_init, problems, seed_responses[:], dependency_graph)

recs_before = rec_evolve.get_recommendations(top_n=10)
ids_before  = {r['question_id'] for r in recs_before}

# 특정 카테고리를 집중적으로 맞히면 그 카테고리 DKT 점수 올라감
# → 해당 카테고리 문제가 추천에서 밀려나야 함
target_cat = recs_before[0]['category']
for p in problem_list:
    if p['category'] == target_cat and p['question_id'] not in {r['question_id'] for r in seed_responses}:
        rec_evolve.update(p['question_id'], True, p['category'], p['subcategory'])
        break

# 취약 카테고리를 계속 틀리면 GKT 점수 올라감
# 충분한 신호를 쌓기 위해 여러 번 오답 누적
answered_so_far = {r['question_id'] for r in seed_responses}
wrong_count = 0
for p in problem_list:
    if p['category'] == weak_cat and p['question_id'] not in answered_so_far:
        rec_evolve.update(p['question_id'], False, p['category'], p['subcategory'])
        answered_so_far.add(p['question_id'])
        wrong_count += 1
        if wrong_count >= 5:
            break

recs_after = rec_evolve.get_recommendations(top_n=10)
ids_after  = {r['question_id'] for r in recs_after}

results.append(check(
    "응답 누적 후 추천 목록 변화 있음",
    ids_before != ids_after,
    f"변화된 문제 수: {len(ids_before.symmetric_difference(ids_after))}개"
))

# Soft Voting은 SAKT/DKT도 함께 반영되므로
# GKT 점수만 기준으로 취약 카테고리가 올라왔는지 확인
all_recs_full = rec_evolve.get_recommendations(top_n=len(problems))
weak_gkt_scores  = [r['scores']['GKT'] for r in all_recs_full if r['category'] == weak_cat]
other_gkt_scores = [r['scores']['GKT'] for r in all_recs_full if r['category'] != weak_cat]
avg_weak_gkt  = sum(weak_gkt_scores)  / len(weak_gkt_scores)  if weak_gkt_scores  else 0
avg_other_gkt = sum(other_gkt_scores) / len(other_gkt_scores) if other_gkt_scores else 0

results.append(check(
    "취약 카테고리 계속 틀린 후 GKT 점수 전체 평균보다 높음",
    avg_weak_gkt > avg_other_gkt,
    f"취약 카테고리 GKT 평균: {avg_weak_gkt:.3f}  /  나머지 GKT 평균: {avg_other_gkt:.3f}"
))

# ─────────────────────────────────────────
# 7. 전체 파이프라인 — 구간별 추천 일관성
#    같은 조건이면 같은 결과가 나와야 함
# ─────────────────────────────────────────
section("7. 추천 일관성 — 같은 입력 → 같은 출력")

status_a = make_status(40.0, seed_responses)
status_b = make_status(40.0, seed_responses)

rec_a = Recommend(status_a, problems, seed_responses, dependency_graph)
rec_b = Recommend(status_b, problems, seed_responses, dependency_graph)

recs_a = rec_a.get_recommendations(top_n=5)
recs_b = rec_b.get_recommendations(top_n=5)

ids_a = [r['question_id'] for r in recs_a]
ids_b = [r['question_id'] for r in recs_b]

results.append(check(
    "같은 입력 → 같은 추천 결과",
    ids_a == ids_b,
    f"A: {ids_a}  /  B: {ids_b}"
))

# ─────────────────────────────────────────
# 최종 결과
# ─────────────────────────────────────────
section("최종 결과")
passed = sum(results)
total  = len(results)
print(f"\n  {passed}/{total} 통과 ({'100%' if passed == total else f'{passed/total*100:.1f}%'})")
if passed == total:
    print(f"\n  ✓ PASS 전체 추천 품질 테스트 통과")
else:
    print(f"\n  ✗ FAIL 일부 추천 품질 테스트 실패")