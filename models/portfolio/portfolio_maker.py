import subprocess
import re


def get_multiline_input(prompt_text):
    print(prompt_text)
    print("👉 (복사+붙여넣기를 한 뒤, 다 썼으면 새로운 줄에 '완료'라고 적고 엔터를 치세요)\n")
    lines = []
    while True:
        line = input()
        if line.strip() == '완료':
            break
        lines.append(line)
    return '\n'.join(lines)


def clean_output(text):
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        if re.search(
                r'Replace with|XXXXXXX|your phone|your email'
                r'|\(.*입력.*\)|\*\*회사명\*\*'
                r'|saisir|저희 회사',
                line, re.IGNORECASE
        ):
            continue
        line = re.sub(r'\b(\w+)\s+\1\b', r'\1', line)
        cleaned.append(line)
    result = '\n'.join(cleaned)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result


print("=" * 50)
print(" 🚀 최고의 백엔드 취업 컨설턴트 봇 🚀 ")
print("=" * 50)

experience = get_multiline_input("[1] 당신의 경험 및 역할을 자유롭게 입력하세요.")
print("-" * 50)
jd = get_multiline_input("[2] 지원할 채용 공고(JD)의 내용을 그대로 복사/붙여넣기 하세요.")

prompt = f"""
당신은 대한민국 최고의 IT 취업 컨설턴트입니다.
아래 정보로 면접관 눈에 띄는 포트폴리오를 작성하세요.

===== 지원자 경험 =====
{experience}

===== 채용공고 =====
{jd}

===== 절대 규칙 =====
1. 경험에 없는 내용, 날짜, 기술 절대 추가 금지
2. placeholder 절대 금지 → 없으면 그 줄 삭제
3. JD에 명시된 회사명을 반드시 찾아서 사용
4. 기술 분류 엄수:
   언어 = Python, Java 등 언어만
   프레임워크 = Django, Spring 등 프레임워크만
   DB = SQLite, MySQL 등 DB만
5. 경험에 없는 기술 추가 금지
6. 100% 자연스러운 한국어, 기술명만 영어 허용

===== 자기소개 예시 (길이와 스타일만 참고) =====
저는 Python과 Django를 활용한 백엔드 개발에 깊은 관심을 가지고 있는 컴퓨터공학과 학생입니다.
대학교 재학 중 팀 프로젝트에 백엔드 개발자로 참여하여 Django REST Framework 기반의
RESTful API를 직접 설계하고 구현한 경험이 있습니다.
특히 JWT 인증 시스템을 구축하고 다양한 API를 개발하면서
실제 서비스 수준의 백엔드 아키텍처를 경험할 수 있었습니다.
또한 AI 기능을 연동하며 외부 API 통합 능력도 키웠습니다.
팀원들과의 협업 과정에서 코드 리뷰와 문서화의 중요성을 몸소 배웠으며,
문제가 발생했을 때 원인을 분석하고 해결책을 찾아내는 능력을 키워왔습니다.
이러한 경험들을 바탕으로 귀사의 백엔드 개발 환경에서 즉시 기여할 수 있다고 확신합니다.

===== 지원 동기 예시 (길이와 스타일만 참고, 반드시 JD 회사명으로 새로 작성) =====
[JD 회사명]은 [JD에서 파악한 회사 특징]으로 저는 이 회사의 기술 문화에 깊이 공감합니다.
특히 [JD 요구사항]과 제가 쌓아온 [경험 역량]이 잘 맞닿아 있다고 생각합니다.
[경험의 특정 프로젝트]에서 쌓은 경험은 [JD 업무]에 직접 기여할 수 있습니다.
입사 후에는 빠르게 팀에 적응하여 실질적인 기여를 시작하고,
장기적으로는 [회사명]의 백엔드 시스템을 더욱 견고하게 만드는 데 이바지하고 싶습니다.

===== 출력 형식 =====

## 1. 지원자 정보
(경험에 있는 항목만, 없으면 그 줄 삭제)

## 2. 자기소개
(예시와 같은 길이와 스타일로, 지원자 경험 기반으로 새로 작성)

## 3. 기술 스택
- 언어:
- 프레임워크:
- DB:
- 기타: (경험에 명시된 것만, 없으면 삭제)

## 4. 경력 및 프로젝트
### [프로젝트명]
- 역할:
- 주요 기여: (JD 키워드와 연결)
- 사용 기술:

## 5. 학력

## 6. 지원 동기
(예시 스타일로, JD 회사명 기반으로 완전히 새로 작성)

## 7. 포부
(4~6문장, 단기/중장기 목표 포함)
"""

try:
    result = subprocess.run(
        ['ollama', 'run', 'mybot_v2', prompt],
        capture_output=True,
        text=True,
        encoding='utf-8',
        timeout=180
    )

    # ANSI 코드 제거
    output = re.sub(
        r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', result.stdout
    )

    # Thinking 과정 제거
    output = re.sub(
        r'Thinking\.\.\..*?\.\.\.done thinking\.',
        '',
        output,
        flags=re.DOTALL
    )

    # 후처리
    output = clean_output(output)

    print("\n" + "=" * 50)
    print(" 📄 생성된 포트폴리오 ")
    print("=" * 50)
    print(output.strip())
    print("=" * 50)

except subprocess.TimeoutExpired:
    print("⏰ 시간 초과! 다시 시도해주세요.")
except Exception as e:
    print(f"❌ 에러: {e}")