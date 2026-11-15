"""台本JSON → 動画 → (任意で)YouTube投稿 → 履歴記録 までを行うCLI。

使い方:
  python -m shorts.build content/examples/sample.json --tts silent      # ローカル確認(無音)
  python -m shorts.build script.json --upload --record                  # 本番(Actions上)
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

from . import render, schema, tts

ROOT = Path(__file__).resolve().parent.parent
JST = timezone(timedelta(hours=9))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--out", default="out")
    ap.add_argument("--tts", choices=["voicevox", "silent"], default="voicevox")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--record", action="store_true", help="content/history.jsonl と content/scripts/ に記録")
    args = ap.parse_args()

    script = schema.load(args.script)
    date = script["date"] or datetime.now(JST).strftime("%Y-%m-%d")
    script["date"] = date
    out = Path(args.out)
    work = out / "work"
    if work.exists():
        shutil.rmtree(work)

    wavs = tts.synthesize(script["lines"], work / "voice", engine=args.tts)
    audio = work / "voice.wav"
    durations = tts.concat_wavs(wavs, audio)
    total = sum(durations)
    print(f"音声: {total:.1f}秒")
    if total > 59.5:
        raise SystemExit(f"動画が長すぎます({total:.1f}秒)。台本を短くしてください")

    bgm = ROOT / "assets" / "bgm.mp3"
    video = out / f"{date}.mp4"
    render.render(script, durations, audio, video, work / "frames", bgm=bgm)
    print(f"動画: {video}")

    video_id = None
    if args.upload:
        from .upload import upload
        video_id = upload(video, script)
        print(f"投稿完了: https://youtube.com/shorts/{video_id}")
        gh_out = os.environ.get("GITHUB_STEP_SUMMARY")
        if gh_out:
            with open(gh_out, "a", encoding="utf-8") as f:
                f.write(f"### {script['title']}\nhttps://youtube.com/shorts/{video_id}\n")

    if args.record:
        scripts_dir = ROOT / "content" / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)
        (scripts_dir / f"{date}.json").write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        entry = {"date": date, "theme": script["theme"], "title": script["title"], "hook": script["hook"],
                 "video_id": video_id, "seconds": round(total, 1)}
        with open(ROOT / "content" / "history.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
