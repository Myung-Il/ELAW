"""
python manage.py build_learning_paths

DB/JobProblems/*.json 을 읽어 Sentence-BERT 임베딩 기반 선행 관계를 계산한 뒤
DB/LearningPaths/*.json 을 생성합니다.

생성된 JSON은 반드시 load_problems 커맨드로 DB에 재적재해야 합니다:
  python manage.py build_learning_paths
  python manage.py load_problems --reset

사용법:
  python manage.py build_learning_paths
  python manage.py build_learning_paths --fast          # 경량 모델 (속도 우선)
  python manage.py build_learning_paths --input-dir /path/to/JobProblems
  python manage.py build_learning_paths --output-dir /path/to/LearningPaths
"""

import logging
import sys
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

# models/curriculum 을 임포트 경로에 추가
_PROJECT_ROOT = Path(__file__).resolve().parents[5]  # ELAW/
_CURRICULUM_ROOT = _PROJECT_ROOT / "models" / "curriculum"
for _p in (_PROJECT_ROOT, _CURRICULUM_ROOT):
    _ps = str(_p)
    if _ps not in sys.path:
        sys.path.insert(0, _ps)

try:
    from models.curriculum.curriculum_builder import process_all_files
    _BUILDER_AVAILABLE = True
except ImportError as _e:
    _BUILDER_AVAILABLE = False
    _IMPORT_ERROR = str(_e)


class Command(BaseCommand):
    help = "JobProblems JSON → LearningPaths JSON 변환 (Sentence-BERT 임베딩 기반)"

    def add_arguments(self, parser):
        default_input  = _PROJECT_ROOT / "DB" / "JobProblems"
        default_output = _PROJECT_ROOT / "DB" / "LearningPaths"
        parser.add_argument(
            "--input-dir",
            type=Path,
            default=default_input,
            help=f"JobProblems JSON 폴더 (기본값: {default_input})",
        )
        parser.add_argument(
            "--output-dir",
            type=Path,
            default=default_output,
            help=f"LearningPaths 출력 폴더 (기본값: {default_output})",
        )
        parser.add_argument(
            "--fast",
            action="store_true",
            help="MiniLM 경량 모델 사용 (속도 우선, 정확도 소폭 감소)",
        )

    def handle(self, *args, **options):
        if not _BUILDER_AVAILABLE:
            raise CommandError(
                f"curriculum_builder 임포트 실패: {_IMPORT_ERROR}\n"
                "pip install sentence-transformers torch networkx numpy 를 실행하세요."
            )

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%H:%M:%S",
        )

        input_dir  = options["input_dir"]
        output_dir = options["output_dir"]
        fast       = options["fast"]

        self.stdout.write(f"입력 폴더: {input_dir}")
        self.stdout.write(f"출력 폴더: {output_dir}")
        self.stdout.write(f"경량 모드: {'ON' if fast else 'OFF'}")
        self.stdout.write("")

        try:
            result = process_all_files(input_dir, output_dir, fast=fast)
        except FileNotFoundError as exc:
            raise CommandError(str(exc))

        processed = result.get("processed", [])
        failed    = result.get("failed", [])

        if processed:
            self.stdout.write(self.style.SUCCESS(f"성공: {len(processed)}개"))
            for name in processed:
                self.stdout.write(f"  v {name}")

        if failed:
            self.stdout.write(self.style.ERROR(f"실패: {len(failed)}개"))
            for item in failed:
                self.stdout.write(f"  x {item['file']} - {item['error']}")

        if failed:
            raise CommandError("일부 파일 처리 실패. 위 로그를 확인하세요.")

        self.stdout.write(self.style.SUCCESS(
            "\n완료. load_problems 커맨드로 DB 재적재를 권장합니다:\n"
            "  python manage.py load_problems --reset"
        ))
