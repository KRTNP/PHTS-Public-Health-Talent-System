import json
import os
import sys

from typhoon_ocr import ocr_document


def main() -> None:
    if len(sys.argv) < 2:
        raise ValueError("Usage: typhoon_ocr_runner.py <file_path> [page_num]")

    file_path = sys.argv[1]
    page_num = None
    if len(sys.argv) >= 3 and sys.argv[2]:
        page_num = int(sys.argv[2])

    base_url = os.getenv("OCR_BASE_URL") or os.getenv("OCR_ENDPOINT") or "https://api.opentyphoon.ai/v1"
    api_key = (
        os.getenv("OCR_API_KEY")
        or os.getenv("TYPHOON_OCR_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )

    kwargs = {"pdf_or_image_path": file_path, "base_url": base_url}
    if api_key:
        kwargs["api_key"] = api_key
    if page_num is not None:
        kwargs["page_num"] = page_num

    markdown = ocr_document(**kwargs)

    print(json.dumps({"markdown": markdown}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
