"""
백준 데이터 수집기 — solved.ac 공개 API 사용
인증 불필요, rate limit: 초당 5회

수집 항목:
  - 사용자 정보 (tier, rating, 풀이 수)
  - 풀이한 문제 목록 + 태그 + 난이도
  - 학습 통계 자동 갱신
"""

import requests
import time
import logging
from datetime import datetime, timezone
from django.utils import timezone as dj_timezone

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
# solved.ac 난이도 매핑 (영어 → 한국어)
# ─────────────────────────────────────────
TIER_MAP = {
    0:  "Unrated",
    1:  "Bronze5",  2:  "Bronze4",  3:  "Bronze3",  4:  "Bronze2",  5:  "Bronze1",
    6:  "Silver5",  7:  "Silver4",  8:  "Silver3",  9:  "Silver2",  10: "Silver1",
    11: "Gold5",    12: "Gold4",    13: "Gold3",    14: "Gold2",    15: "Gold1",
    16: "Platinum5",17: "Platinum4",18: "Platinum3",19: "Platinum2",20: "Platinum1",
    21: "Diamond5", 22: "Diamond4", 23: "Diamond3", 24: "Diamond2", 25: "Diamond1",
    26: "Ruby5",    27: "Ruby4",    28: "Ruby3",    29: "Ruby2",    30: "Ruby1",
}

TAG_KO_MAP = {
    "implementation":        "구현",
    "math":                  "수학",
    "dp":                    "DP",
    "data_structures":       "자료구조",
    "graphs":                "그래프",
    "greedy":                "그리디",
    "string":                "문자열",
    "sorting":               "정렬",
    "bfs":                   "BFS",
    "dfs":                   "DFS",
    "binary_search":         "이분탐색",
    "two_pointer":           "투포인터",
    "tree":                  "트리",
    "stack":                 "스택",
    "queue":                 "큐",
    "heap":                  "힙",
    "backtracking":          "백트래킹",
    "divide_and_conquer":    "분할정복",
    "geometry":              "기하학",
    "number_theory":         "정수론",
    "combinatorics":         "조합론",
    "simulation":            "시뮬레이션",
    "shortest_path":         "최단경로",
    "mst":                   "MST",
    "parametric_search":     "매개변수탐색",
    "segment_tree":          "세그먼트트리",
    "disjoint_set":          "유니온파인드",
    "prefix_sum":            "누적합",
    "hash_map":              "해시맵",
    "recursion":             "재귀",
}

BASE_URL = "https://solved.ac/api/v3"
HEADERS  = {"Accept": "application/json"}


class BaekjoonCollector:
    """
    사용 예시:
        collector = BaekjoonCollector(user, platform_link)
        result = collector.sync()
        # result = {"synced": 42, "errors": 0}
    """

    def __init__(self, user, platform_link):
        self.user          = user
        self.platform_link = platform_link
        self.handle        = platform_link.external_id   # 백준 아이디
        self.synced        = 0
        self.errors        = 0

    # ─────────────────────────────────────────
    # 공개 메서드
    # ─────────────────────────────────────────

    def sync(self):
        """전체 동기화 진입점"""
        logger.info(f"[Baekjoon] {self.handle} 동기화 시작")

        try:
            # 1. 사용자 존재 확인
            user_info = self._fetch_user_info()
            if user_info is None:
                return {"synced": 0, "errors": 1,
                        "message": f"'{self.handle}' 아이디를 찾을 수 없습니다."}

            # 2. 풀이한 문제 수집 (최대 10,000개, 페이지네이션)
            problems = self._fetch_solved_problems()

            # 3. DB 저장
            self._save_solve_history(problems)

            # 4. 학습 통계 갱신
            self._rebuild_stats()

            # 5. last_synced 업데이트
            self.platform_link.last_synced = dj_timezone.now()
            self.platform_link.save(update_fields=["last_synced"])

            logger.info(f"[Baekjoon] {self.handle} 완료 — {self.synced}건 저장")
            return {
                "synced":  self.synced,
                "errors":  self.errors,
                "tier":    TIER_MAP.get(user_info.get("tier", 0), "Unrated"),
                "rating":  user_info.get("rating", 0),
                "message": "동기화 완료",
            }

        except Exception as e:
            logger.error(f"[Baekjoon] {self.handle} 오류: {e}")
            return {"synced": self.synced, "errors": 1, "message": str(e)}

    # ─────────────────────────────────────────
    # solved.ac API 호출
    # ─────────────────────────────────────────

    def _fetch_user_info(self):
        """사용자 기본 정보 조회"""
        url = f"{BASE_URL}/user/show"
        resp = self._get(url, params={"handle": self.handle})
        if resp is None or resp.status_code == 404:
            return None
        return resp.json()

    def _fetch_solved_problems(self):
        """
        solved.ac /search/problem 으로 해당 유저가 푼 문제 전체 조회.
        한 페이지 = 50개, 최대 200페이지(10,000문제)까지 수집.
        """
        problems = []
        page     = 1

        while True:
            url  = f"{BASE_URL}/search/problem"
            params = {
                "query": f"solved_by:{self.handle}",
                "page":  page,
                "sort":  "id",
                "direction": "asc",
            }
            resp = self._get(url, params=params)
            if resp is None:
                break

            data  = resp.json()
            items = data.get("items", [])
            if not items:
                break

            problems.extend(items)
            logger.debug(f"[Baekjoon] 페이지 {page} — {len(items)}개")

            # 마지막 페이지 도달 시 중단
            total_count = data.get("count", 0)
            if len(problems) >= total_count:
                break

            page += 1
            time.sleep(0.2)   # rate limit 준수

        logger.info(f"[Baekjoon] {self.handle} 총 {len(problems)}개 문제 수집")
        return problems

    # ─────────────────────────────────────────
    # DB 저장
    # ─────────────────────────────────────────

    def _save_solve_history(self, problems):
        """수집한 문제를 SolveHistory에 저장 (중복 무시)"""
        from core.models import SolveHistory

        for p in problems:
            try:
                problem_id    = str(p.get("problemId", ""))
                problem_title = p.get("titleKo") or p.get("title") or ""
                difficulty    = TIER_MAP.get(p.get("level", 0), "Unrated")

                # 태그 한국어 변환
                raw_tags  = [t.get("key", "") for t in p.get("tags", [])]
                algo_tags = [TAG_KO_MAP.get(t, t) for t in raw_tags if t]

                # solved_at: API에서 제공하지 않으므로 수집 시각 사용
                solved_at = dj_timezone.now()

                obj, created = SolveHistory.objects.get_or_create(
                    user       = self.user,
                    platform   = SolveHistory.Platform.BAEKJOON,
                    problem_id = problem_id,
                    defaults   = {
                        "problem_title": problem_title,
                        "status":        SolveHistory.Status.SOLVED,
                        "language":      None,   # solved.ac는 언어 정보 미제공
                        "algo_tags":     algo_tags,
                        "difficulty":    difficulty,
                        "solved_at":     solved_at,
                        "source":        SolveHistory.Source.API,
                    }
                )
                if created:
                    self.synced += 1

            except Exception as e:
                logger.warning(f"[Baekjoon] 문제 {p.get('problemId')} 저장 실패: {e}")
                self.errors += 1

    def _rebuild_stats(self):
        """algo_tag 별 학습 통계 재집계"""
        from core.models import SolveHistory, LearningStats
        from django.db.models import Count, Q

        rows = (
            SolveHistory.objects
            .filter(user=self.user, platform=SolveHistory.Platform.BAEKJOON)
            .values_list("algo_tags", "status")
        )

        # 태그별 집계
        tag_stats = {}   # tag -> {"total": 0, "solved": 0}
        for tags_json, status in rows:
            if not tags_json:
                continue
            for tag in tags_json:
                if tag not in tag_stats:
                    tag_stats[tag] = {"total": 0, "solved": 0}
                tag_stats[tag]["total"] += 1
                if status == SolveHistory.Status.SOLVED:
                    tag_stats[tag]["solved"] += 1

        for tag, counts in tag_stats.items():
            total  = counts["total"]
            solved = counts["solved"]
            rate   = round(solved / total * 100, 2) if total else 0.0

            LearningStats.objects.update_or_create(
                user      = self.user,
                stat_type = LearningStats.StatType.ALGO_TAG,
                stat_key  = tag,
                defaults  = {
                    "total_count":  total,
                    "solved_count": solved,
                    "correct_rate": rate,
                }
            )

    # ─────────────────────────────────────────
    # HTTP 헬퍼
    # ─────────────────────────────────────────

    def _get(self, url, params=None, retries=3):
        """재시도 포함 GET 요청"""
        for attempt in range(retries):
            try:
                resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
                if resp.status_code == 429:
                    wait = 2 ** attempt
                    logger.warning(f"[Baekjoon] Rate limit, {wait}초 대기")
                    time.sleep(wait)
                    continue
                return resp
            except requests.RequestException as e:
                logger.warning(f"[Baekjoon] 요청 실패 ({attempt+1}/{retries}): {e}")
                time.sleep(1)
        return None
