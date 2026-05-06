"""
jobs/portfolio_ai.py

본인이 학습시킨 'mybot' 모델 (Ollama)을 사용해 포트폴리오 본문을 생성하는 헬퍼.

사용 예시:
    from jobs.portfolio_ai import generate_portfolio
    result = generate_portfolio(experience_text, jd_text)
    # result = {"success": True, "content": "...", "prompt": "..."}

요구사항:
    - 서버 PC에 ollama 설치 (https://ollama.com)
    - mybot 모델이 등록되어 있어야 함
        ollama list  →  mybot:latest 확인
"""

import os
import re
import logging
import subprocess

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
# 프롬프트 템플릿
# ─────────────────────────────────────────

PORTFOLIO_PROMPT_TEMPLATE = """다음 정보를 바탕으로 면접관이 바로 읽을 수 있는 포트폴리오 본문을 작성해 줘.

[내가 실제로 다녔던 직장과 과거 경험]
{experience}

[내가 앞으로 입사하고 싶은 목표 회사의 공고]
{jd}

[엄격한 작성 규칙]
1. 이력서의 '경력 및 프로젝트' 섹션에는 오직 [내가 실제로 다녔던 직장과 과거 경험]에 적힌 내용만 적는다.
2. [내가 앞으로 입사하고 싶은 목표 회사의 공고]에 나온 회사명은 이력서의 '지원 동기'나 마지막 '포부'를 말할 때만 사용한다.
3. 반드시 100% 자연스러운 한국어로만 작성한다.
"""


# ─────────────────────────────────────────
# ANSI 이스케이프 코드 제거 정규식
# ─────────────────────────────────────────
# Ollama가 터미널 표시용으로 출력하는 제어문자를 제거
# 예: \x1b[K, \x1b[1D, \x1b[?25l, \x1b[31m 등
ANSI_ESCAPE_PATTERN = re.compile(
    r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])'
)


def _clean_ansi(text: str) -> str:
    """Ollama 출력에서 ANSI 이스케이프 코드 제거"""
    if not text:
        return text
    # 1. ANSI 제어문자 제거
    cleaned = ANSI_ESCAPE_PATTERN.sub('', text)
    # 2. 캐리지 리턴 제거 (\r 만 단독으로 있는 경우)
    cleaned = cleaned.replace('\r\n', '\n').replace('\r', '')
    # 3. 양쪽 공백 정리
    cleaned = cleaned.strip()
    return cleaned


# ─────────────────────────────────────────
# 메인 함수
# ─────────────────────────────────────────

def generate_portfolio(experience: str, jd: str, *,
                       model_name: str = "mybot",
                       timeout: int = 120) -> dict:
    """
    Ollama로 포트폴리오 본문 생성.

    매개변수:
        experience: 사용자가 입력한 경력/역할 텍스트
        jd        : 채용공고(JD) 텍스트
        model_name: ollama 모델명 (기본 'mybot')
        timeout   : 타임아웃 초 (기본 120초)

    반환:
        {
            "success": True/False,
            "content": "생성된 포트폴리오 본문 (정리됨)",
            "prompt":  "AI에 보낸 프롬프트 전문 (재현용)",
            "error":   에러 메시지 (success=False 일 때만)
        }
    """
    if not experience or not experience.strip():
        return {
            "success": False,
            "content": "",
            "prompt": "",
            "error": "experience(경력 내용)는 필수입니다.",
        }
    if not jd or not jd.strip():
        return {
            "success": False,
            "content": "",
            "prompt": "",
            "error": "jd(채용공고)는 필수입니다.",
        }

    prompt = PORTFOLIO_PROMPT_TEMPLATE.format(
        experience=experience.strip(),
        jd=jd.strip(),
    )

    logger.info(f"[Portfolio AI] {model_name} 호출 시작 — 프롬프트 길이: {len(prompt)}")

    # ⭐ ollama 의 컬러/터미널 제어문자 비활성화
    env = os.environ.copy()
    env['NO_COLOR'] = '1'
    env['TERM'] = 'dumb'

    try:
        result = subprocess.run(
            ['ollama', 'run', model_name, prompt],
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=timeout,
            env=env,                     # ⭐ NO_COLOR 환경 전달
        )

        if result.returncode != 0:
            logger.error(f"[Portfolio AI] ollama 종료 코드 {result.returncode}")
            logger.error(f"[Portfolio AI] stderr: {result.stderr[:500]}")
            return {
                "success": False,
                "content": "",
                "prompt": prompt,
                "error": f"ollama 실행 실패 (returncode={result.returncode}): "
                         f"{result.stderr[:300]}",
            }

        # ⭐ ANSI 제어문자 제거 + 정리
        content = _clean_ansi(result.stdout or "")

        if not content:
            return {
                "success": False,
                "content": "",
                "prompt": prompt,
                "error": "AI가 빈 응답을 반환했습니다. 다시 시도해주세요.",
            }

        logger.info(f"[Portfolio AI] 응답 수신 — 정리 후 길이: {len(content)}")
        return {
            "success": True,
            "content": content,
            "prompt": prompt,
            "error": None,
        }

    except subprocess.TimeoutExpired:
        logger.error(f"[Portfolio AI] {timeout}초 타임아웃")
        return {
            "success": False,
            "content": "",
            "prompt": prompt,
            "error": f"AI 응답이 {timeout}초 내에 오지 않았습니다. 잠시 후 다시 시도해주세요.",
        }

    except FileNotFoundError:
        logger.error("[Portfolio AI] ollama 명령어를 찾을 수 없음")
        return {
            "success": False,
            "content": "",
            "prompt": prompt,
            "error": "서버에 Ollama가 설치되어 있지 않습니다. 관리자에게 문의해주세요.",
        }

    except Exception as e:
        logger.exception(f"[Portfolio AI] 예외 발생: {e}")
        return {
            "success": False,
            "content": "",
            "prompt": prompt,
            "error": f"포트폴리오 생성 중 오류가 발생했습니다: {str(e)[:200]}",
        }


# ─────────────────────────────────────────
# JD 텍스트 빌더 (JobPosting → 텍스트)
# ─────────────────────────────────────────

def build_jd_text(posting) -> str:
    """JobPosting 모델을 ollama가 이해할 수 있는 텍스트로 변환."""
    parts = []
    parts.append(f"회사명: {posting.company.name}")
    parts.append(f"공고 제목: {posting.title}")

    if posting.job_role:
        parts.append(f"직무: {posting.job_role}")
    if posting.career_level:
        parts.append(f"경력: {posting.get_career_level_display()}")
    if posting.description:
        parts.append(f"\n[채용 공고 내용]\n{posting.description}")

    if posting.required_skills:
        skills = ", ".join(posting.required_skills)
        parts.append(f"\n[필수 자격 / 기술스택]\n{skills}")

    if posting.preferred_skills:
        skills = ", ".join(posting.preferred_skills)
        parts.append(f"\n[우대 사항]\n{skills}")

    return "\n".join(parts)