import subprocess

# 여러 줄을 입력받기 위한 마법의 함수
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

print("="*50)
print(" 🚀 최고의 백엔드 취업 컨설턴트 봇 🚀 ")
print("="*50)

# 1. 다중 줄 입력 함수로 경험과 JD 받기
experience = get_multiline_input("[1] 당신의 경험 및 역할을 자유롭게 입력하세요.")
print("-" * 50)
jd = get_multiline_input("[2] 지원할 채용 공고(JD)의 내용을 그대로 복사/붙여넣기 하세요.")

# 2. 프롬프트 조립

prompt = f"""
다음 정보를 바탕으로 면접관이 바로 읽을 수 있는 포트폴리오 본문을 작성해 줘.

[내가 실제로 다녔던 직장과 과거 경험]
{experience}
ㄴ
[내가 앞으로 입사하고 싶은 목표 회사의 공고]
{jd}

[엄격한 작성 규칙]
1. 이력서의 '경력 및 프로젝트' 섹션에는 오직 [내가 실제로 다녔던 직장과 과거 경험]에 적힌 내용만 적는다. 
2. [내가 앞으로 입사하고 싶은 목표 회사의 공고]에 나온 회사명은 이력서의 '지원 동기'나 마지막 '포부'를 말할 때만 사용한다.
3. 반드시 100% 자연스러운 한국어로만 작성한다.
"""

# 3. 봇 실행 및 결과 출력
try:
    result = subprocess.run(
        ['ollama', 'run', 'mybot', prompt], 
        capture_output=True, 
        text=True, 
        encoding='utf-8'
    )
    print(result.stdout)
    
except Exception as e:
    print(f"에러가 발생했습니다: {e}")