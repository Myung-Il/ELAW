"""
jobs/portfolio_ai.py

본인이 학습시킨 'mybot' 모델 (Ollama)을 사용해 포트폴리오 본문을 생성하는 헬퍼.

호출 방식: Ollama HTTP API (POST /api/generate)
    - `ollama run` CLI 서브프로세스는 콘솔 인코딩/행 버퍼 문제로 응답이 멈추는
      경우가 있어 HTTP API로 호출한다 (ANSI 제어문자도 없음).

사용 예시:
    from jobs.portfolio_ai import generate_portfolio
    result = generate_portfolio(experience_text, jd_text)
    # result = {"success": True, "content": "...", "prompt": "..."}

요구사항:
    - Ollama 앱(서버)이 실행 중이어야 함 (기본 http://127.0.0.1:11434)
    - mybot 모델이 등록되어 있어야 함
        ollama list  →  mybot:latest 확인
"""

import os
import re
import logging

import requests

logger = logging.getLogger(__name__)

# Ollama 서버 주소 — OLLAMA_HOST 환경변수로 재정의 가능
def _ollama_base_url() -> str:
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").strip().rstrip("/")
    if not host.startswith("http"):
        host = "http://" + host
    return host


# ─────────────────────────────────────────
# 프롬프트 템플릿
# ─────────────────────────────────────────

PORTFOLIO_PROMPT_TEMPLATE = """당신은 전문 이력서 작성 어시스턴트입니다. 아래 입력을 바탕으로 한국어 포트폴리오를 작성하세요.

[지원자 이름]
{applicant_name}

[지원자 경력 및 경험]
{experience}

[채용공고]
{jd}

[작성 규칙]
1. '경력 및 프로젝트', '성과 및 활동', '학력', '기타', '특징'은 오직 위 [지원자 경력 및 경험]에 명시된 사실만 사용합니다. 입력에 없는 학교명·회사명·날짜·수치·기술명을 절대 추가하지 마세요. (예: 입력에 학교명이 없으면 "서울대학교" 같은 가짜 학교명을 만들지 마세요.)
2. [채용공고]의 회사명·직무명은 최상단 제목과 '지원 동기' 단락에서만 사용합니다. '경력 및 프로젝트' narrative에는 절대 채용공고의 기술 스택(예: Python, PyTorch, OpenCV)을 끼워 넣지 마세요.
3. 입력에 해당 섹션 정보가 없으면 그 섹션 본문에 "* (해당 사항 없음)" 한 줄만 적습니다. 추측이나 보강 금지.
4. 코드블록이나 메타 설명 없이 본문만 출력합니다.
5. 아래 양식의 꺽쇠(< … >)로 둘러싸인 부분은 실제 내용으로 교체합니다. 꺽쇠 자체나 안내문은 출력에 남기지 마세요.

[출력 양식]

## {applicant_name}

**지원 직무:** <채용공고의 직무명만>

**경력 및 프로젝트**

<지원자 경력 및 경험을 2~4문단의 자연스러운 한국어 서술로 작성>

**지원 동기**

<채용공고의 회사·직무에 지원하는 동기 2~4문장>

**성과 및 활동**

* **<지원자 경력에 등장한 회사/프로젝트명>:**
    * <구체적 활동 또는 성과>
    * <구체적 활동 또는 성과>

**기타**

* <지원자 경력에 명시된 자격증/수상/어학. 명시되지 않았으면 "(해당 사항 없음)">

**특징**

* <지원자 경력에서 드러나는 강점 1>
* <지원자 경력에서 드러나는 강점 2>
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
                       applicant_name: str = "지원자",
                       model_name: str = "mybot",
                       timeout: int = 300) -> dict:
    """
    Ollama HTTP API로 포트폴리오 본문 생성.

    매개변수:
        experience: 사용자가 입력한 경력/역할 텍스트
        jd        : 채용공고(JD) 텍스트
        model_name: ollama 모델명 (기본 'mybot')
        timeout   : 타임아웃 초 (기본 300초 — CPU 추론 환경 고려)

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
        applicant_name=(applicant_name or "지원자").strip(),
        experience=experience.strip(),
        jd=jd.strip(),
    )

    logger.info(f"[Portfolio AI] {model_name} 호출 시작 — 프롬프트 길이: {len(prompt)}")

    try:
        resp = requests.post(
            f"{_ollama_base_url()}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
            },
            timeout=timeout,
        )

        if resp.status_code == 404:
            logger.error(f"[Portfolio AI] 모델 없음: {model_name}")
            return {
                "success": False,
                "content": "",
                "prompt": prompt,
                "error": f"'{model_name}' 모델이 등록되어 있지 않습니다. "
                         f"models/portfolio 에서 'ollama create {model_name} -f Modelfile' 을 실행해주세요.",
                "error_type": "unavailable",
            }

        if resp.status_code != 200:
            logger.error(f"[Portfolio AI] HTTP {resp.status_code}: {resp.text[:500]}")
            return {
                "success": False,
                "content": "",
                "prompt": prompt,
                "error": f"Ollama 호출 실패 (HTTP {resp.status_code}): {resp.text[:300]}",
            }

        # ANSI 제어문자 제거 + 정리 (HTTP API 응답에는 보통 없지만 안전망)
        content = _clean_ansi(resp.json().get("response") or "")

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

    except requests.exceptions.Timeout:
        logger.error(f"[Portfolio AI] {timeout}초 타임아웃")
        return {
            "success": False,
            "content": "",
            "prompt": prompt,
            "error": f"AI 응답이 {timeout}초 내에 오지 않았습니다. 잠시 후 다시 시도해주세요.",
            "error_type": "timeout",
        }

    except requests.exceptions.ConnectionError:
        logger.error("[Portfolio AI] Ollama 서버에 연결할 수 없음 (%s)", _ollama_base_url())
        return {
            "success": False,
            "content": "",
            "prompt": prompt,
            "error": "Ollama 서버에 연결할 수 없습니다. Ollama 앱을 실행한 후 다시 시도해주세요. "
                     "(실행 확인: ollama list)",
            "error_type": "unavailable",
        }

    except Exception as e:
        logger.exception(f"[Portfolio AI] 예외 발생: {e}")
        return {
            "success": False,
            "content": "",
            "prompt": prompt,
            "error": f"포트폴리오 생성 중 오류가 발생했습니다: {str(e)[:200]}",
            "error_type": "error",
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