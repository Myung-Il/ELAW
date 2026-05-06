#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dkt.py  —  Deep Knowledge Tracing
==============================================================================
BKT의 한계(단순 확률 모델)를 넘어 LSTM 기반 신경망으로
사용자의 풀이 시퀀스를 학습하여 숙련도를 예측한다.

구조
────
입력: [문제 임베딩(384dim) + 정오답(1)] 시퀀스  →  shape (seq_len, 385)
LSTM(hidden=128, layers=2)
출력: 각 시점에서 다음 문제를 맞출 확률  →  shape (seq_len, 1)

전환 기준
──────────
한 직업에서 풀이 기록이 MIN_RECORDS(기본 30개) 이상 쌓이면
recommender.py가 BKT 대신 DKT를 사용한다.

설치 요구사항
─────────────
pip install torch sentence-transformers
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

import numpy as np

# ── 딥러닝 의존성 ──────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    from sentence_transformers import SentenceTransformer
    _DL_AVAILABLE = True
except ImportError:
    _DL_AVAILABLE = False

# ── 상수 ───────────────────────────────────────────────────────
MIN_RECORDS   = 30          # DKT 전환 최소 풀이 기록 수
EMBED_DIM     = 384         # Sentence-BERT 임베딩 차원 (MiniLM)
INPUT_DIM     = EMBED_DIM + 1  # 임베딩 + 정오답(0/1)
HIDDEN_DIM    = 128
NUM_LAYERS    = 2
LEARNING_RATE = 1e-3
EPOCHS        = 30          # 온라인 재학습 epoch 수
MODEL_NAME    = "paraphrase-multilingual-MiniLM-L12-v2"

# ── 싱글턴 임베딩 모델 ─────────────────────────────────────────
_embed_model: Optional[Any] = None

def get_embed_model():
    global _embed_model
    if not _DL_AVAILABLE:
        return None
    if _embed_model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _embed_model = SentenceTransformer(MODEL_NAME, device=device)
    return _embed_model


def embed_problem(problem: dict) -> np.ndarray:
    """
    문제 딕셔너리 → 384차원 임베딩 벡터.
    scenario + skills_required 를 합쳐서 인코딩한다.
    임베딩 모델이 없으면 0벡터를 반환한다.
    """
    model = get_embed_model()
    if model is None:
        return np.zeros(EMBED_DIM, dtype=np.float32)

    scenario = str(problem.get("scenario", ""))
    skills   = ", ".join(problem.get("skills_required", []))
    text     = f"{scenario} {skills}".strip() or "unknown"

    vec = model.encode(text, normalize_embeddings=True, show_progress_bar=False)
    return vec.astype(np.float32)


# ── LSTM 모델 정의 ─────────────────────────────────────────────

class DKTNet(nn.Module):
    """
    LSTM 기반 Deep Knowledge Tracing 신경망.

    입력 shape : (batch, seq_len, INPUT_DIM)
    출력 shape : (batch, seq_len, 1)  — 각 시점의 정답 확률
    """

    def __init__(
        self,
        input_dim:  int = INPUT_DIM,
        hidden_dim: int = HIDDEN_DIM,
        num_layers: int = NUM_LAYERS,
        dropout:    float = 0.2,
    ):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.fc  = nn.Linear(hidden_dim, 1)
        self.sig = nn.Sigmoid()

    def forward(self, x: "torch.Tensor") -> "torch.Tensor":
        out, _ = self.lstm(x)          # (batch, seq, hidden)
        logit  = self.fc(out)          # (batch, seq, 1)
        return self.sig(logit)


# ── DKT 래퍼 ──────────────────────────────────────────────────

class DKTModel:
    """
    DKTNet의 학습·추론·저장·로드를 담당하는 래퍼 클래스.

    사용 흐름
    ─────────
    1. DKTModel() 생성
    2. add_record(problem, correct) 로 풀이 기록 누적
    3. len(model) >= MIN_RECORDS 가 되면 train() 호출
    4. predict(problem) 로 숙련도(0~1) 추론
    5. save(path) / load(path) 로 상태 영속화
    """

    def __init__(self):
        self._records: list[dict] = []   # {"embedding": np.ndarray, "correct": bool}
        self._net: Optional["DKTNet"] = None
        self._trained: bool = False

        if _DL_AVAILABLE:
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self._device = "cpu"

    def __len__(self) -> int:
        return len(self._records)

    def is_trained(self) -> bool:
        return self._trained

    # ── 기록 추가 ──────────────────────────────────────────────

    def add_record(self, problem: dict, correct: bool) -> None:
        """풀이 결과 한 건 추가."""
        emb = embed_problem(problem)
        self._records.append({"embedding": emb, "correct": correct})

    # ── 학습 ───────────────────────────────────────────────────

    def train(self, epochs: int = EPOCHS) -> float:
        """
        누적된 풀이 시퀀스로 DKTNet을 (재)학습한다.
        반환: 마지막 epoch 의 평균 BCE loss
        """
        if not _DL_AVAILABLE:
            return float("inf")
        if len(self._records) < 2:
            return float("inf")

        # 시퀀스 구성 — 현재 입력으로 다음 정답을 예측
        embs    = np.stack([r["embedding"] for r in self._records])  # (N, 384)
        labels  = np.array([float(r["correct"]) for r in self._records], dtype=np.float32)  # (N,)
        correct = labels.reshape(-1, 1)  # (N, 1)

        # 입력: [임베딩 | 정오답]  shape (1, N, 385)
        inputs  = np.concatenate([embs, correct], axis=1)   # (N, 385)
        x       = torch.tensor(inputs[:-1], dtype=torch.float32).unsqueeze(0).to(self._device)
        y       = torch.tensor(labels[1:],  dtype=torch.float32).unsqueeze(0).unsqueeze(-1).to(self._device)

        if self._net is None:
            self._net = DKTNet().to(self._device)

        optimizer = torch.optim.Adam(self._net.parameters(), lr=LEARNING_RATE)
        criterion = nn.BCELoss()

        self._net.train()
        last_loss = float("inf")
        for _ in range(epochs):
            optimizer.zero_grad()
            pred = self._net(x)           # (1, seq-1, 1)
            loss = criterion(pred, y)
            loss.backward()
            optimizer.step()
            last_loss = loss.item()

        self._trained = True
        return last_loss

    # ── 추론 ───────────────────────────────────────────────────

    def predict(self, problem: dict) -> float:
        """
        특정 문제에 대한 숙련도(정답 확률) 예측.
        학습 전이거나 DL 미설치면 0.3(초기값) 반환.
        """
        if not _DL_AVAILABLE or not self._trained or self._net is None:
            return 0.3

        emb     = embed_problem(problem)
        # 마지막 기록의 정오답 붙여서 입력 구성
        last_correct = float(self._records[-1]["correct"]) if self._records else 0.0
        inp     = np.concatenate([emb, [last_correct]], axis=0)  # (385,)
        x       = torch.tensor(inp, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(self._device)

        self._net.eval()
        with torch.no_grad():
            prob = self._net(x).item()   # scalar
        return float(prob)

    def weakness_score(self, problem: dict) -> float:
        """
        약점 점수 = 1 - 숙련도 예측값.
        recommender.py 의 BKT weakness_score 와 같은 인터페이스.
        """
        return 1.0 - self.predict(problem)

    # ── 저장 / 로드 ────────────────────────────────────────────

    def save(self, path: str) -> None:
        """모델 가중치 + 풀이 기록을 저장."""
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)

        # 풀이 기록 직렬화 (numpy → list)
        records_serial = [
            {"embedding": r["embedding"].tolist(), "correct": r["correct"]}
            for r in self._records
        ]
        meta_path = path.replace(".pt", "_meta.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({"records": records_serial, "trained": self._trained}, f)

        # 가중치 저장
        if self._net is not None and _DL_AVAILABLE:
            torch.save(self._net.state_dict(), path)

    @classmethod
    def load(cls, path: str) -> "DKTModel":
        """저장된 상태에서 복원."""
        model = cls()
        meta_path = path.replace(".pt", "_meta.json")

        if os.path.exists(meta_path):
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            model._records = [
                {"embedding": np.array(r["embedding"], dtype=np.float32), "correct": r["correct"]}
                for r in meta.get("records", [])
            ]
            model._trained = meta.get("trained", False)

        if _DL_AVAILABLE and os.path.exists(path) and model._trained:
            model._net = DKTNet().to(model._device)
            model._net.load_state_dict(
                torch.load(path, map_location=model._device)
            )
            model._net.eval()

        return model

    def stats(self) -> dict:
        """BKTModel.stats() 와 동일한 인터페이스."""
        total = len(self._records)
        if total == 0:
            return {"total_attempted": 0, "avg_mastery_pct": None, "weakest_ids": []}
        correct = sum(1 for r in self._records if r["correct"])
        avg_pct = round(correct / total * 100, 1)
        return {
            "total_attempted": total,
            "avg_mastery_pct": avg_pct,
            "weakest_ids":     [],   # DKT는 문제별 ID 추적 없음 (시퀀스 기반)
        }