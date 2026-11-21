"""投稿した動画の再生数を記録し、収益化の進み具合をまとめる。

  python tools/stats.py          # YouTube から取得して stats.json / stats_history.jsonl / STATS.md を更新
  python tools/stats.py --offline  # 取得せず、手元の stats.json から STATS.md だけ作り直す

必要な環境変数: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
(コメント返信と同じトークン。youtube.force-ssl の権限で再生数を読める)

チャンネルの数字と、動画ごとの再生数・高評価・コメント数だけを保存する(視聴者の情報は保存しない)。
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HISTORY = ROOT / "history.jsonl"
STATS = ROOT / "stats.json"
SNAPSHOTS = ROOT / "stats_history.jsonl"
REPORT = ROOT / "STATS.md"
JST = timezone(timedelta(hours=9))

# YouTube パートナープログラム(ショート)の目安。2027-02-01 から新規参加は 2,000万回/90日 になる
YPP_SUBS = 1000
YPP_SHORTS_VIEWS_NOW = 10_000_000
YPP_SHORTS_VIEWS_2027 = 20_000_000
YPP_DEADLINE = date(2027, 1, 31)


def load_history() -> list[dict]:
    if not HISTORY.exists():
        return []
    return [json.loads(l) for l in HISTORY.read_text().splitlines() if l.strip()]


def fetch(videos: list[dict]) -> dict:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
    )
    api = build("youtube", "v3", credentials=creds, cache_discovery=False)
    ch = api.channels().list(part="statistics", mine=True).execute()["items"][0]["statistics"]
    ids = [v["video_id"] for v in videos if v.get("video_id")]
    per: dict[str, dict] = {}
    for i in range(0, len(ids), 50):
        resp = api.videos().list(part="statistics", id=",".join(ids[i : i + 50])).execute()
        for it in resp.get("items", []):
            s = it["statistics"]
            per[it["id"]] = {k: int(s.get(k + "Count", 0)) for k in ("view", "like", "comment")}
    return {
        "updated": datetime.now(JST).strftime("%Y-%m-%d %H:%M"),
        "channel": {
            "subscribers": int(ch.get("subscriberCount", 0)),
            "views": int(ch.get("viewCount", 0)),
            "videos": int(ch.get("videoCount", 0)),
        },
        "videos": per,
    }


def fmt(n: int) -> str:
    return f"{n:,}"


def report(stats: dict, videos: list[dict]) -> str:
    today = datetime.now(JST).date()
    per = stats["videos"]
    rows = []
    recent90 = 0
    for v in videos:
        s = per.get(v.get("video_id") or "", {})
        if not s:
            continue
        posted = date.fromisoformat(v["date"])
        if (today - posted).days < 90:
            recent90 += s["view"]
        rows.append((v, s))
    ch = stats["channel"]
    days_left = (YPP_DEADLINE - today).days
    lines = [
        "# 再生数レポート（自動更新）",
        "",
        f"更新: {stats['updated']}（日本時間）",
        "",
        "## 収益化（YouTube パートナープログラム・ショート）までの進み具合",
        "",
        "| 項目 | 今 | 条件 | 達成率 |",
        "|---|---|---|---|",
        f"| 登録者 | {fmt(ch['subscribers'])}人 | {fmt(YPP_SUBS)}人 | {min(100, ch['subscribers'] * 100 / YPP_SUBS):.1f}% |",
        f"| 直近90日に投稿した動画の再生 | {fmt(recent90)}回 | {fmt(YPP_SHORTS_VIEWS_NOW)}回 | {recent90 * 100 / YPP_SHORTS_VIEWS_NOW:.2f}% |",
        "",
        f"- 今の条件（90日で1,000万回）で申し込めるのは **2027年1月31日まで（あと{days_left}日）**。2月1日からは2,000万回になる",
        "- 「直近90日に投稿した動画の再生」は目安。正確な数字（90日間の有効視聴回数）は YouTube Studio の「収益化」画面で確認する",
        f"- チャンネル全体: 再生 {fmt(ch['views'])}回 / 動画 {ch['videos']}本",
        "",
        "## 動画ごと（再生の多い順）",
        "",
        "| 投稿日 | タイトル | 再生 | 高評価 | コメント |",
        "|---|---|---|---|---|",
    ]
    for v, s in sorted(rows, key=lambda r: -r[1]["view"]):
        title = v["title"].replace(" #shorts", "").replace("|", "／")
        url = f"https://youtube.com/shorts/{v['video_id']}"
        lines.append(f"| {v['date']} | [{title}]({url}) | {fmt(s['view'])} | {fmt(s['like'])} | {fmt(s['comment'])} |")
    if rows:
        avg = sum(s["view"] for _, s in rows) / len(rows)
        lines += ["", f"平均再生: {fmt(round(avg))}回 / 本（{len(rows)}本）"]
    return "\n".join(lines) + "\n"


def main() -> None:
    videos = load_history()
    if "--offline" in sys.argv:
        stats = json.loads(STATS.read_text())
    else:
        stats = fetch(videos)
        STATS.write_text(json.dumps(stats, ensure_ascii=False, indent=1) + "\n")
        snap = {"date": datetime.now(JST).strftime("%Y-%m-%d"), "channel": stats["channel"],
                "views": {k: v["view"] for k, v in stats["videos"].items()}}
        with SNAPSHOTS.open("a") as f:
            f.write(json.dumps(snap, ensure_ascii=False) + "\n")
    REPORT.write_text(report(stats, videos))
    print(REPORT.read_text())


if __name__ == "__main__":
    main()
