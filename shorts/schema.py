"""台本JSONの読み込みと検証。

台本の形式:
{
  "date": "2026-11-16",
  "theme": "あるある",
  "title": "スロッターあるある5選 #shorts",
  "hook": "ドパガキなら\\n全部わかる",
  "description": "概要欄テキスト",
  "tags": ["パチスロ", "スロット"],
  "lines": [
    {"speaker": "zundamon", "text": "読み上げ文", "telop": "表示テキスト(省略可)", "emphasis": false}
  ]
}
"""
from __future__ import annotations

import json
import re
from pathlib import Path

SPEAKERS = {
    # VOICEVOX のスピーカーID（ノーマルスタイル）
    "zundamon": {"id": 3, "name": "ずんだもん", "credit": "VOICEVOX:ずんだもん", "color": (86, 190, 76)},
    "metan": {"id": 2, "name": "四国めたん", "credit": "VOICEVOX:四国めたん", "color": (232, 92, 160)},
}

THEMES = ["あるある", "設定判別", "収支", "雑学", "ランキング", "名言", "ネタ"]

MAX_LINES = 16
MIN_LINES = 4
MAX_TEXT = 70
MAX_TELOP = 40


class ScriptError(ValueError):
    pass


def _clean(s: str) -> str:
    return re.sub(r"[ \t]+", " ", s.strip())


def validate(data: dict) -> dict:
    errors: list[str] = []
    for key in ("title", "hook", "lines"):
        if not data.get(key):
            errors.append(f"'{key}' がありません")
    if errors:
        raise ScriptError("; ".join(errors))

    title = _clean(data["title"])
    if "#shorts" not in title.lower():
        title = f"{title} #shorts"
    if len(title) > 100:
        errors.append(f"タイトルが長すぎます({len(title)}文字 > 100)")

    theme = data.get("theme", "ネタ")
    lines = data["lines"]
    if not (MIN_LINES <= len(lines) <= MAX_LINES):
        errors.append(f"lines は {MIN_LINES}〜{MAX_LINES} 行にしてください(現在 {len(lines)})")

    out_lines = []
    for i, ln in enumerate(lines, 1):
        sp = ln.get("speaker", "zundamon")
        if sp not in SPEAKERS:
            errors.append(f"{i}行目: speaker は {list(SPEAKERS)} のいずれか")
        text = _clean(ln.get("text", ""))
        if not text:
            errors.append(f"{i}行目: text が空です")
        if len(text) > MAX_TEXT:
            errors.append(f"{i}行目: text が長すぎます({len(text)} > {MAX_TEXT})")
        telop = ln.get("telop") or text
        if len(telop.replace("\n", "")) > MAX_TELOP:
            errors.append(f"{i}行目: telop が長すぎます(> {MAX_TELOP})。短い telop を別途指定してください")
        out_lines.append({
            "speaker": sp,
            "text": text,
            "telop": telop.strip(),
            "emphasis": bool(ln.get("emphasis", False)),
        })

    total_chars = sum(len(l["text"]) for l in out_lines)
    if total_chars > 380:
        errors.append(f"読み上げ文字数が多すぎます({total_chars} > 380)。60秒を超える恐れがあります")

    if errors:
        raise ScriptError("\n".join(errors))

    tags = [t.strip().lstrip("#") for t in data.get("tags", []) if t.strip()]
    return {
        "date": data.get("date", ""),
        "theme": theme,
        "title": title,
        "hook": data["hook"].strip(),
        "description": data.get("description", "").strip(),
        "tags": tags[:15],
        "lines": out_lines,
    }


def load(path: str | Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return validate(json.load(f))


def loads(text: str) -> dict:
    return validate(json.loads(text))


if __name__ == "__main__":
    import sys

    try:
        s = load(sys.argv[1])
    except ScriptError as e:
        print("NG:\n" + str(e))
        sys.exit(1)
    print(f"OK: {s['title']} / {len(s['lines'])}行 / {sum(len(l['text']) for l in s['lines'])}文字")
