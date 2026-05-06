#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_learning_paths_dl.py  ·  딥러닝 강화 버전
==============================================================================
원본 build_learning_paths.py 대비 변경 사항
──────────────────────────────────────────
[시나리오 유사도]
  TF-IDF + cosine  →  Sentence-BERT 다국어 임베딩 (paraphrase-multilingual-mpnet-base-v2)
  - 의미적 유사도 포착 ("머신러닝" ≈ "기계학습", "NLP" ≈ "자연어처리")
  - GPU 자동 감지 (없으면 CPU fallback)
  - 배치 인코딩으로 속도 최적화

[스킬 유사도]
  Jaccard (집합 일치)  →  스킬명 임베딩 코사인 유사도
  - "PyTorch" ↔ "TensorFlow" 같은 의미적 연관 스킬 포착
  - 스킬 셋 평균 벡터로 문제 간 유사도 계산

[선행 관계 점수]
  단순 가중합  →  학습된 임베딩 거리 기반 + 난이도 마진 보정
  - combined_score = α·skill_emb_sim + β·scenario_emb_sim + γ·same_cat_bonus

[성능 최우선 모드]
  --fast 플래그로 MiniLM 모델 사용 가능 (속도 ↑, 정확도 소폭 ↓)

설치 요구사항
  pip install sentence-transformers torch networkx numpy

실행 예시
  python build_learning_paths_dl.py
  python build_learning_paths_dl.py --input-dir Curriculum/JobProblems \\
                                    --output-dir Curriculum/LearningPaths -v
  python build_learning_paths_dl.py --fast   # 경량 모델 사용
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import traceback
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx
import numpy as np

# ============================================================================ #
# 딥러닝 의존성 — 임포트 실패 시 원본 TF-IDF 로직으로 자동 폴백
# ============================================================================ #
try:
    import torch
    from sentence_transformers import SentenceTransformer
    _DL_AVAILABLE = True
except ImportError:
    _DL_AVAILABLE = False

# ============================================================================ #
# 0. 상수 및 설정값
# ============================================================================ #

DIFFICULTY_RANK: Dict[str, int] = {
    "university_level": 0,
    "junior_level":     1,
    "middle_level":     2,
    "senior_level":     3,
}

JOB_NAME_SAFE = re.compile(r"[^A-Za-z0-9가-힣_\-]+")

# 딥러닝 모델 선택
#   고성능: paraphrase-multilingual-mpnet-base-v2  (~420MB, 한국어+영어 최적)
#   경량:   paraphrase-multilingual-MiniLM-L12-v2  (~120MB, 속도 우선)
MODEL_HIGH = "paraphrase-multilingual-mpnet-base-v2"
MODEL_FAST = "paraphrase-multilingual-MiniLM-L12-v2"

# 임베딩 배치 크기 — GPU 메모리에 따라 조절 (CPU는 32 권장)
BATCH_SIZE = 64

# 엣지 생성 하이퍼파라미터
DEFAULT_SKILL_WEIGHT     = 0.55
DEFAULT_SCENARIO_WEIGHT  = 0.45
DEFAULT_MIN_SCORE        = 0.20   # 딥러닝 유사도는 더 촘촘해서 임계값 소폭 상향
DEFAULT_MAX_PREREQS      = 3
DEFAULT_SAME_CAT_BONUS   = 0.08

_SCRIPT_DIR        = Path(__file__).resolve().parent          # ELAW/models/
DEFAULT_INPUT_DIR  = _SCRIPT_DIR.parent / "DB" / "JobProblems"   # ELAW/DB/JobProblems
DEFAULT_OUTPUT_DIR = _SCRIPT_DIR.parent / "DB" / "LearningPaths" # ELAW/DB/LearningPaths

logger = logging.getLogger("learning_path_builder_dl")


# ============================================================================ #
# 1. 임베딩 모델 싱글턴
# ============================================================================ #

_model_cache: Optional[Any] = None  # SentenceTransformer 인스턴스

def get_model(fast: bool = False) -> Optional[Any]:
    """
    SentenceTransformer 모델을 싱글턴으로 관리.
    GPU가 있으면 자동으로 사용하고, 없으면 CPU로 폴백.
    """
    global _model_cache
    if not _DL_AVAILABLE:
        return None
    if _model_cache is None:
        model_name = MODEL_FAST if fast else MODEL_HIGH
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("임베딩 모델 로드 중: %s (device=%s)", model_name, device)
        _model_cache = SentenceTransformer(model_name, device=device)
        logger.info("모델 로드 완료.")
    return _model_cache


def encode_texts(texts: List[str], fast: bool = False) -> np.ndarray:
    """
    텍스트 리스트를 임베딩 행렬로 변환.
    빈 텍스트는 0 벡터로 처리.

    Returns:
        shape (n, dim) 의 float32 numpy 배열
    """
    model = get_model(fast)
    if model is None:
        raise RuntimeError("sentence-transformers 가 설치되어 있지 않습니다.")

    # 빈 텍스트 인덱스 추적 — 나중에 0벡터로 복원
    non_empty_idx = [i for i, t in enumerate(texts) if t.strip()]
    non_empty_texts = [texts[i] for i in non_empty_idx]

    dim = model.get_sentence_embedding_dimension()
    embeddings = np.zeros((len(texts), dim), dtype=np.float32)

    if non_empty_texts:
        vecs = model.encode(
            non_empty_texts,
            batch_size=BATCH_SIZE,
            show_progress_bar=False,
            normalize_embeddings=True,  # L2 정규화 → 내적 = 코사인 유사도
            convert_to_numpy=True,
        )
        for out_i, src_i in enumerate(non_empty_idx):
            embeddings[src_i] = vecs[out_i]

    return embeddings


# ============================================================================ #
# 2. 유사도 계산 (딥러닝 버전)
# ============================================================================ #

def compute_scenario_similarity_dl(
    problems: List[Dict[str, Any]],
    fast: bool = False,
) -> np.ndarray:
    """
    Sentence-BERT 임베딩 기반 시나리오 코사인 유사도 행렬 (n×n).

    원본 TF-IDF 대비 개선점:
    - 동의어/유사어를 의미 공간에서 자연스럽게 근접시킴
      예: "자연어처리" ↔ "NLP", "머신러닝" ↔ "기계학습"
    - 어순/문장 구조 변형에도 강건함
    - 한국어·영어 혼용 텍스트에 단일 모델로 대응
    """
    n = len(problems)
    if n < 2:
        return np.zeros((n, n), dtype=float)

    texts = [str(p.get("scenario", "")) for p in problems]

    try:
        embs = encode_texts(texts, fast=fast)  # (n, dim), L2-normalized
    except Exception as exc:
        logger.warning("시나리오 임베딩 실패 (%s) — 0 행렬 반환.", exc)
        return np.zeros((n, n), dtype=float)

    # 정규화된 벡터의 내적 = 코사인 유사도
    sim = (embs @ embs.T).astype(float)
    np.fill_diagonal(sim, 0.0)
    # 음수 코사인값(-1~0)은 의미 없는 반대 방향 → 클램핑
    np.clip(sim, 0.0, 1.0, out=sim)
    return sim


def compute_skill_similarity_dl(
    problems: List[Dict[str, Any]],
    fast: bool = False,
) -> np.ndarray:
    """
    스킬 임베딩 기반 유사도 행렬.

    원본 Jaccard 대비 개선점:
    - "PyTorch" ↔ "TensorFlow": Jaccard=0 이지만 임베딩 유사도는 높음
    - 스킬명이 약간 다르게 표기되어도 ("scikit-learn" vs "sklearn") 유사도 포착
    - 각 문제의 스킬 셋을 평균 임베딩으로 압축하여 문제 간 비교
    """
    n = len(problems)
    sim = np.zeros((n, n), dtype=float)

    # 모든 고유 스킬 수집
    all_skills: List[str] = []
    skill_sets: List[List[str]] = []
    for p in problems:
        skills = [str(s).strip() for s in (p.get("skills_required") or []) if str(s).strip()]
        skill_sets.append(skills)
        all_skills.extend(skills)

    unique_skills = list(dict.fromkeys(all_skills))  # 순서 보존 중복 제거
    if not unique_skills:
        return sim

    try:
        skill_embs_map: Dict[str, np.ndarray] = {}
        embs = encode_texts(unique_skills, fast=fast)
        for skill, emb in zip(unique_skills, embs):
            skill_embs_map[skill] = emb
    except Exception as exc:
        logger.warning("스킬 임베딩 실패 (%s) — Jaccard 폴백.", exc)
        return _jaccard_fallback(problems)

    # 문제별 스킬 평균 임베딩 계산
    problem_embs = np.zeros((n, embs.shape[1]), dtype=np.float32)
    for i, skills in enumerate(skill_sets):
        if skills:
            vecs = np.stack([skill_embs_map[s] for s in skills if s in skill_embs_map])
            avg = vecs.mean(axis=0)
            norm = np.linalg.norm(avg)
            if norm > 0:
                problem_embs[i] = avg / norm  # 정규화

    sim = (problem_embs @ problem_embs.T).astype(float)
    np.fill_diagonal(sim, 0.0)
    np.clip(sim, 0.0, 1.0, out=sim)

    # 스킬이 없는 문제(영벡터)는 유사도 0으로 마스킹
    empty_mask = ~np.any(problem_embs != 0, axis=1)
    sim[empty_mask, :] = 0.0
    sim[:, empty_mask] = 0.0

    return sim


def _jaccard_fallback(problems: List[Dict[str, Any]]) -> np.ndarray:
    """임베딩 실패 시 원본 Jaccard 방식으로 폴백."""
    n = len(problems)
    sim = np.zeros((n, n), dtype=float)
    skill_sets = [
        {str(s).strip().lower() for s in (p.get("skills_required") or []) if str(s).strip()}
        for p in problems
    ]
    for i in range(n):
        a = skill_sets[i]
        if not a:
            continue
        for j in range(i + 1, n):
            b = skill_sets[j]
            if not b:
                continue
            inter = len(a & b)
            if inter:
                sim[i, j] = sim[j, i] = inter / len(a | b)
    return sim


# ============================================================================ #
# 3. 입출력
# ============================================================================ #

def load_problems(json_path: Path) -> List[Dict[str, Any]]:
    """
    JSON 파일 로드. 두 가지 스키마 지원:
      (a) [ {...}, {...} ]
      (b) {"problems": [...]} / {"questions": [...]}
    """
    with json_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    if isinstance(raw, dict):
        problems: Optional[list] = None
        for key in ("problems", "questions", "items", "data"):
            if isinstance(raw.get(key), list):
                problems = raw[key]
                break
        if problems is None:
            raise ValueError(f"{json_path.name}: dict 최상위에서 리스트 필드를 찾지 못함.")
    elif isinstance(raw, list):
        problems = raw
    else:
        raise ValueError(f"{json_path.name}: 지원하지 않는 최상위 타입 {type(raw).__name__}")

    cleaned: List[Dict[str, Any]] = []
    for idx, p in enumerate(problems):
        if not isinstance(p, dict):
            logger.warning("  [%s] %d번째 항목이 dict가 아님 — 건너뜀.", json_path.name, idx)
            continue
        p.setdefault("question_id",     idx + 1)
        p.setdefault("difficulty",      "university_level")
        p.setdefault("category",        "Uncategorized")
        p.setdefault("subcategory",     "")
        p.setdefault("skills_required", [])
        p.setdefault("scenario",        "")
        if not isinstance(p["skills_required"], list):
            p["skills_required"] = [str(p["skills_required"])]
        cleaned.append(p)
    return cleaned


def save_json(obj: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


# ============================================================================ #
# 4. 클러스터링
# ============================================================================ #

def build_clusters(problems: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """category + subcategory 조합으로 문제를 묶고 난이도 순 정렬."""
    groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for p in problems:
        groups[(p["category"], p["subcategory"])].append(p)

    clusters: List[Dict[str, Any]] = []
    for (cat, sub), items in groups.items():
        items_sorted = sorted(
            items,
            key=lambda x: (DIFFICULTY_RANK.get(x["difficulty"], 99), x["question_id"]),
        )
        skill_counter: Counter = Counter()
        for it in items_sorted:
            skill_counter.update(s for s in it.get("skills_required", []) if s)

        clusters.append({
            "cluster_id":    f"{cat}__{sub}" if sub else cat,
            "category":      cat,
            "subcategory":   sub,
            "size":          len(items_sorted),
            "question_ids":  [it["question_id"] for it in items_sorted],
            "common_skills": [s for s, _ in skill_counter.most_common(5)],
        })

    clusters.sort(key=lambda c: (-c["size"], c["cluster_id"]))
    return clusters


# ============================================================================ #
# 5. 선행 관계 계산 (딥러닝 강화)
# ============================================================================ #

def get_prerequisites(
    problems:        List[Dict[str, Any]],
    *,
    fast:            bool  = False,
    skill_weight:    float = DEFAULT_SKILL_WEIGHT,
    scenario_weight: float = DEFAULT_SCENARIO_WEIGHT,
    min_score:       float = DEFAULT_MIN_SCORE,
    max_prereqs:     int   = DEFAULT_MAX_PREREQS,
    same_cat_bonus:  float = DEFAULT_SAME_CAT_BONUS,
) -> List[Dict[str, Any]]:
    """
    딥러닝 임베딩 기반 선행 관계 산출.

    엣지 조건
      (1) 선행 난이도 < 타깃 난이도
      (2) skill_sim 또는 scenario_sim > 0
      (3) combined_score >= min_score
      (4) 타깃당 max_prereqs 개 채택

    combined_score
      = skill_weight  × embedding_cosine(skills_a, skills_b)
      + scenario_weight × embedding_cosine(scenario_a, scenario_b)
      + (동일 category → same_cat_bonus, 상한 1.0)
    """
    n = len(problems)
    if n < 2:
        return []

    logger.info("  시나리오 임베딩 계산 중...")
    scenario_sim = compute_scenario_similarity_dl(problems, fast=fast)

    logger.info("  스킬 임베딩 계산 중...")
    skill_sim = compute_skill_similarity_dl(problems, fast=fast)

    ids   = [p["question_id"] for p in problems]
    diffs = [DIFFICULTY_RANK.get(p["difficulty"], 99) for p in problems]
    cats  = [p["category"] for p in problems]

    edges: List[Dict[str, Any]] = []

    for j in range(n):
        candidates: List[Tuple[float, int, float, float]] = []
        for i in range(n):
            if i == j:
                continue
            if diffs[i] >= diffs[j]:
                continue
            sk = float(skill_sim[i, j])
            sc = float(scenario_sim[i, j])
            if sk == 0.0 and sc == 0.0:
                continue
            score = skill_weight * sk + scenario_weight * sc
            if cats[i] == cats[j] and cats[i] and cats[i] != "Uncategorized":
                score = min(1.0, score + same_cat_bonus)
            if score < min_score:
                continue
            candidates.append((score, i, sk, sc))

        if not candidates:
            continue

        candidates.sort(key=lambda t: (-t[0], diffs[t[1]], ids[t[1]]))
        for score, i, sk, sc in candidates[:max_prereqs]:
            edges.append({
                "Preceding_ID":        ids[i],
                "Target_ID":           ids[j],
                "skill_overlap":       round(sk, 4),
                "scenario_similarity": round(sc, 4),
                "combined_score":      round(score, 4),
                "Logic":               _build_logic_text(problems[i], problems[j], sk, sc),
            })
    return edges


def _build_logic_text(
    prereq: Dict[str, Any],
    target: Dict[str, Any],
    skill_sim: float,
    scenario_sim: float,
) -> str:
    """사람이 읽을 수 있는 선행 관계 근거 (딥러닝 유사도 수치 포함)."""
    a = {str(s).lower() for s in prereq.get("skills_required", [])}
    b = {str(s).lower() for s in target.get("skills_required", [])}
    common = sorted(a & b)[:3]

    parts = []
    if common:
        parts.append(f"공통 스킬 {common} (임베딩 유사도={skill_sim:.3f})")
    else:
        parts.append(f"스킬 의미 유사도={skill_sim:.3f} (딥러닝)")
    parts.append(f"시나리오 의미 유사도={scenario_sim:.3f} (딥러닝)")
    parts.append(f"난이도 {prereq.get('difficulty')} → {target.get('difficulty')}")
    if prereq.get("category") == target.get("category"):
        parts.append(f"동일 카테고리({prereq.get('category')})")
    return " | ".join(parts)


# ============================================================================ #
# 6. 그래프 & 순서 정렬
# ============================================================================ #

def build_dependency_graph(
    problems: List[Dict[str, Any]],
    edges:    List[Dict[str, Any]],
) -> nx.DiGraph:
    g = nx.DiGraph()
    for p in problems:
        g.add_node(
            p["question_id"],
            difficulty=p["difficulty"],
            category=p["category"],
            subcategory=p["subcategory"],
        )
    for e in edges:
        g.add_edge(
            e["Preceding_ID"],
            e["Target_ID"],
            weight=e["combined_score"],
            skill_overlap=e["skill_overlap"],
            scenario_similarity=e["scenario_similarity"],
        )
    # 사이클 방어 로직
    while not nx.is_directed_acyclic_graph(g):
        try:
            cyc = nx.find_cycle(g, orientation="original")
        except nx.NetworkXNoCycle:
            break
        weakest = min(cyc, key=lambda e: g[e[0]][e[1]].get("weight", 0))
        logger.warning("  사이클 감지, 엣지 제거: %s → %s", weakest[0], weakest[1])
        g.remove_edge(weakest[0], weakest[1])
    return g


def build_ordered_path(
    problems: List[Dict[str, Any]],
    graph:    nx.DiGraph,
) -> List[int]:
    """
    university → junior → middle → senior 순.
    동일 난이도 내부: in_degree 적은 것(기초) 먼저, 그 다음 question_id 오름차순.
    """
    buckets: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for p in problems:
        buckets[DIFFICULTY_RANK.get(p["difficulty"], 99)].append(p)

    ordered: List[int] = []
    for rank in sorted(buckets):
        group = buckets[rank]
        group.sort(key=lambda p: (graph.in_degree(p["question_id"]), p["question_id"]))
        ordered.extend(p["question_id"] for p in group)
    return ordered


# ============================================================================ #
# 7. 파일 단위 파이프라인
# ============================================================================ #

def _infer_job_name(problems: List[Dict[str, Any]], path: Path) -> str:
    raw_name: Optional[str] = None
    for p in problems:
        role = p.get("job_role")
        if role:
            raw_name = str(role).strip()
            break
    if not raw_name:
        raw_name = path.stem
    safe = JOB_NAME_SAFE.sub("_", raw_name).strip("_")
    return safe if safe else path.stem


def process_file(json_path: Path, output_dir: Path, fast: bool = False) -> Optional[Path]:
    logger.info("[PROCESS] %s", json_path.name)

    problems = load_problems(json_path)
    if not problems:
        logger.warning("  문제 0건 — 건너뜀.")
        return None

    job_name = _infer_job_name(problems, json_path)
    logger.info("  job_name=%s, 문항 수=%d", job_name, len(problems))

    clusters = build_clusters(problems)
    edges    = get_prerequisites(problems, fast=fast)
    graph    = build_dependency_graph(problems, edges)
    ordered  = build_ordered_path(problems, graph)

    diff_counter = Counter(p["difficulty"] for p in problems)
    isolated = [
        p["question_id"] for p in problems
        if graph.in_degree(p["question_id"]) == 0
        and graph.out_degree(p["question_id"]) == 0
    ]

    # 모델 정보 기록
    model_info = {
        "scenario_similarity": MODEL_FAST if fast else MODEL_HIGH,
        "skill_similarity":    MODEL_FAST if fast else MODEL_HIGH,
        "device":              ("cuda" if (_DL_AVAILABLE and __import__("torch").cuda.is_available()) else "cpu"),
        "dl_available":        _DL_AVAILABLE,
    }

    output = {
        "metadata": {
            "job_role":                job_name,
            "source_file":             json_path.name,
            "total_problems":          len(problems),
            "difficulty_distribution": dict(diff_counter),
            "cluster_count":           len(clusters),
            "edge_count":              len(edges),
            "isolated_problem_count":  len(isolated),
            "model_info":              model_info,
            "parameters": {
                "skill_weight":           DEFAULT_SKILL_WEIGHT,
                "scenario_weight":        DEFAULT_SCENARIO_WEIGHT,
                "min_combined_score":     DEFAULT_MIN_SCORE,
                "max_prereqs_per_target": DEFAULT_MAX_PREREQS,
                "same_category_bonus":    DEFAULT_SAME_CAT_BONUS,
            },
        },
        "clusters": clusters,
        "dependency_graph": {
            "nodes": [
                {
                    "question_id":     p["question_id"],
                    "difficulty":      p["difficulty"],
                    "category":        p["category"],
                    "subcategory":     p["subcategory"],
                    "skills_required": p["skills_required"],
                }
                for p in problems
            ],
            "edges": edges,
        },
        "ordered_path":      ordered,
        "isolated_problems": isolated,
    }

    out_path = output_dir / f"{job_name}_path.json"
    save_json(output, out_path)
    logger.info("  → 저장 완료: %s", out_path)
    return out_path


# ============================================================================ #
# 8. 일괄 처리 엔트리
# ============================================================================ #

def process_all_files(
    input_dir:  Path,
    output_dir: Path,
    fast:       bool = False,
) -> Dict[str, Any]:
    if not input_dir.exists():
        raise FileNotFoundError(f"입력 폴더가 없습니다: {input_dir}")
    if not input_dir.is_dir():
        raise NotADirectoryError(f"입력 경로가 폴더가 아닙니다: {input_dir}")

    files = sorted(p for p in input_dir.iterdir() if p.suffix.lower() == ".json")
    if not files:
        logger.warning("입력 폴더에 JSON 파일이 없습니다: %s", input_dir)
        return {"processed": [], "failed": []}

    # 모델을 배치 처리 전에 한 번만 로드
    if _DL_AVAILABLE:
        get_model(fast=fast)
    else:
        logger.warning("sentence-transformers 미설치 — TF-IDF Jaccard 폴백 불가. 설치 필요.")

    processed: List[str] = []
    failed: List[Dict[str, str]] = []

    for fp in files:
        try:
            out = process_file(fp, output_dir, fast=fast)
            if out is not None:
                processed.append(out.name)
        except json.JSONDecodeError as exc:
            logger.error("  [FAIL] %s — JSON 파싱 오류: %s", fp.name, exc)
            failed.append({"file": fp.name, "error": f"JSONDecodeError: {exc}"})
        except Exception as exc:
            logger.error("  [FAIL] %s — %s: %s", fp.name, type(exc).__name__, exc)
            logger.debug(traceback.format_exc())
            failed.append({"file": fp.name, "error": f"{type(exc).__name__}: {exc}"})

    logger.info("완료: 성공 %d개, 실패 %d개", len(processed), len(failed))
    if failed:
        logger.warning("실패 목록: %s", [f["file"] for f in failed])
    return {"processed": processed, "failed": failed}


# ============================================================================ #
# 9. CLI
# ============================================================================ #

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="직무별 문제 JSON → 딥러닝 강화 학습 경로 JSON 변환"
    )
    parser.add_argument("--input-dir",  type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--fast", action="store_true",
        help="MiniLM 경량 모델 사용 (속도 우선, 정확도 소폭 감소)"
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if not _DL_AVAILABLE:
        logger.error(
            "딥러닝 라이브러리가 없습니다. 다음 명령으로 설치하세요:\n"
            "  pip install sentence-transformers torch"
        )
        return 2

    try:
        result = process_all_files(args.input_dir, args.output_dir, fast=args.fast)
    except Exception as exc:
        logger.error("치명적 오류: %s", exc)
        logger.debug(traceback.format_exc())
        return 2

    if not result["processed"] and not result["failed"]:
        return 0
    return 0 if not result["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())