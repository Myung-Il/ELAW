#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import subprocess

# 1. 필수 모듈 자동 설치 함수
def install_requirements():
    req_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    if os.path.exists(req_file):
        print("필수 모듈을 확인하고 설치합니다. 잠시만 기다려주세요...")
        try:
            # pip install -r requirements.txt 명령어 실행
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file])
            print("모듈 설치 완료!\n")
        except subprocess.CalledProcessError:
            print("모듈 설치 중 오류가 발생했습니다.")
            sys.exit(1)

# 2. 다른 외부 모듈을 불러오기 전에 가장 먼저 실행!
install_requirements()

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
