"""
GitHub 데이터 수집기 — GitHub REST API v3 사용
인증: Personal Access Token (PAT)

수집 항목:
  - 공개 저장소 목록 (이름, 설명, 언어, 스타, 최근 업데이트)
  - 언어별 사용량 통계
  - 최근 커밋 활동 (contributions 근사값)
  - 학습 통계(언어별) 자동 갱신
"""

import requests
import time
import logging
from django.conf import settings
from django.utils import timezone as dj_timezone

logger = logging.getLogger(__name__)

BASE_URL = "https://api.github.com"


class GitHubCollector:
    """
    사용 예시:
        collector = GitHubCollector(user, platform_link)
        result = collector.sync()
        # result = {"repos": 12, "languages": {"Python": 42300, ...}, "errors": 0}
    """

    def __init__(self, user, platform_link):
        self.user          = user
        self.platform_link = platform_link
        self.github_id     = platform_link.external_id   # GitHub 아이디

        # PAT: platform_link.access_token 우선, 없으면 settings.GITHUB_TOKEN
        token = (platform_link.access_token or
                 getattr(settings, "GITHUB_TOKEN", None))

        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"
        else:
            logger.warning("[GitHub] PAT 없이 실행 — rate limit 60회/시간 적용")

    # ─────────────────────────────────────────
    # 공개 메서드
    # ─────────────────────────────────────────

    def sync(self):
        """전체 동기화 진입점"""
        logger.info(f"[GitHub] {self.github_id} 동기화 시작")

        try:
            # 1. 사용자 존재 확인
            user_info = self._fetch_user_info()
            if user_info is None:
                return {"repos": 0, "errors": 1,
                        "message": f"'{self.github_id}' GitHub 계정을 찾을 수 없습니다."}

            # 2. 공개 저장소 수집
            repos = self._fetch_repos()

            # 3. 언어 통계 집계
            lang_stats = self._aggregate_languages(repos)

            # 4. 학습 통계(언어별) 갱신
            self._save_language_stats(lang_stats)

            # 5. 포트폴리오용 저장소 요약 저장
            self._save_portfolio_repos(repos, user_info)

            # 6. last_synced 업데이트
            self.platform_link.last_synced = dj_timezone.now()
            self.platform_link.save(update_fields=["last_synced"])

            logger.info(f"[GitHub] {self.github_id} 완료 — {len(repos)}개 저장소")
            return {
                "repos":     len(repos),
                "languages": lang_stats,
                "followers": user_info.get("followers", 0),
                "public_repos": user_info.get("public_repos", 0),
                "errors":    0,
                "message":   "동기화 완료",
            }

        except Exception as e:
            logger.error(f"[GitHub] {self.github_id} 오류: {e}")
            return {"repos": 0, "errors": 1, "message": str(e)}

    # ─────────────────────────────────────────
    # GitHub API 호출
    # ─────────────────────────────────────────

    def _fetch_user_info(self):
        """사용자 기본 정보"""
        url  = f"{BASE_URL}/users/{self.github_id}"
        resp = self._get(url)
        if resp is None or resp.status_code == 404:
            return None
        return resp.json()

    def _fetch_repos(self):
        """
        공개 저장소 전체 수집 (페이지네이션).
        fork 저장소는 제외하여 본인 작업만 수집.
        """
        repos = []
        page  = 1

        while True:
            url  = f"{BASE_URL}/users/{self.github_id}/repos"
            params = {
                "type":      "owner",   # fork 제외
                "sort":      "updated",
                "direction": "desc",
                "per_page":  100,
                "page":      page,
            }
            resp = self._get(url, params=params)
            if resp is None:
                break

            items = resp.json()
            if not items:
                break

            # fork 저장소 추가 필터링
            own_repos = [r for r in items if not r.get("fork", False)]
            repos.extend(own_repos)
            logger.debug(f"[GitHub] 저장소 페이지 {page} — {len(own_repos)}개")

            if len(items) < 100:   # 마지막 페이지
                break
            page += 1
            time.sleep(0.1)

        return repos

    def _aggregate_languages(self, repos):
        """
        각 저장소의 언어 통계를 합산.
        GitHub API /repos/{owner}/{repo}/languages 호출.
        단, 저장소가 많으면 상위 20개만 처리하여 rate limit 절약.
        """
        lang_bytes = {}
        target_repos = repos[:20]   # 상위 20개 (최근 업데이트 순)

        for repo in target_repos:
            repo_name = repo.get("name", "")
            url  = f"{BASE_URL}/repos/{self.github_id}/{repo_name}/languages"
            resp = self._get(url)
            if resp is None:
                continue

            for lang, byte_count in resp.json().items():
                lang_bytes[lang] = lang_bytes.get(lang, 0) + byte_count
            time.sleep(0.1)

        # 비율(%) 계산
        total = sum(lang_bytes.values()) or 1
        lang_stats = {
            lang: round(byte_count / total * 100, 2)
            for lang, byte_count in sorted(
                lang_bytes.items(), key=lambda x: -x[1]
            )
        }
        return lang_stats

    # ─────────────────────────────────────────
    # DB 저장
    # ─────────────────────────────────────────

    def _save_language_stats(self, lang_stats):
        """언어별 사용 비율을 LearningStats에 저장"""
        from core.models import LearningStats

        for lang, ratio in lang_stats.items():
            LearningStats.objects.update_or_create(
                user      = self.user,
                stat_type = LearningStats.StatType.LANGUAGE,
                stat_key  = lang,
                defaults  = {
                    "total_count":  round(ratio),   # % 를 total_count로 근사 저장
                    "solved_count": round(ratio),
                    "correct_rate": ratio,
                }
            )

    def _save_portfolio_repos(self, repos, user_info):
        """
        포트폴리오 자동 갱신 — Portfolio.content_json 의 projects 섹션 업데이트.
        기존 포트폴리오가 없으면 새로 생성.
        """
        from core.models import Portfolio

        # 저장소 요약 (상위 5개)
        top_repos = []
        for r in repos[:5]:
            top_repos.append({
                "name":        r.get("name", ""),
                "description": r.get("description") or "",
                "language":    r.get("language") or "N/A",
                "stars":       r.get("stargazers_count", 0),
                "url":         r.get("html_url", ""),
                "updated_at":  r.get("updated_at", ""),
            })

        github_section = {
            "type":        "github",
            "title":       "GitHub 프로젝트",
            "username":    self.github_id,
            "followers":   user_info.get("followers", 0),
            "public_repos": user_info.get("public_repos", 0),
            "top_repos":   top_repos,
        }

        # 기존 활성 포트폴리오가 있으면 github 섹션만 업데이트
        portfolio = Portfolio.objects.filter(user=self.user, is_public=True).first()
        if portfolio and portfolio.content_json:
            sections = portfolio.content_json.get("sections", [])
            # 기존 github 섹션 교체 또는 추가
            updated = False
            for i, sec in enumerate(sections):
                if sec.get("type") == "github":
                    sections[i] = github_section
                    updated = True
                    break
            if not updated:
                sections.append(github_section)
            portfolio.content_json["sections"] = sections
            portfolio.save(update_fields=["content_json", "updated_at"])
        else:
            # 포트폴리오가 없으면 기본 구조로 신규 생성
            import uuid
            Portfolio.objects.create(
                user         = self.user,
                title        = f"{self.user.name}의 포트폴리오",
                content_json = {"sections": [github_section]},
                public_slug  = str(uuid.uuid4())[:8],
                is_public    = True,
            )

    # ─────────────────────────────────────────
    # HTTP 헬퍼
    # ─────────────────────────────────────────

    def _get(self, url, params=None, retries=3):
        """재시도 포함 GET 요청 + rate limit 처리"""
        for attempt in range(retries):
            try:
                resp = requests.get(
                    url, params=params, headers=self.headers, timeout=10
                )
                # Rate limit 초과
                if resp.status_code == 403:
                    reset_at = int(resp.headers.get("X-RateLimit-Reset", 0))
                    remaining = int(resp.headers.get("X-RateLimit-Remaining", 0))
                    if remaining == 0 and reset_at:
                        import time as t
                        wait = max(reset_at - t.time(), 0) + 1
                        logger.warning(f"[GitHub] Rate limit, {wait:.0f}초 대기")
                        time.sleep(min(wait, 60))
                        continue
                return resp
            except requests.RequestException as e:
                logger.warning(f"[GitHub] 요청 실패 ({attempt+1}/{retries}): {e}")
                time.sleep(1)
        return None
