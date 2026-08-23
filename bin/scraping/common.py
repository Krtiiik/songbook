import re


def sanitize_filename(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]+', " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value or "untitled"
