"""YouTube コメントの取得と返信。

  python tools/comments.py fetch            # 未対応の新しいコメントを comments/inbox.json に書く
  python tools/comments.py reply plan.json  # 返信を投稿し、対応済みを記録、リクエストを requests.md に追加
  python tools/comments.py post <動画ID> <script.json>  # 投稿直後に、コメントを促すコメントを書き込む

plan.json の形式:
  {"replies": [{"id": "<コメントID>", "text": "返信文"}],
   "skip": ["<返信しないコメントID>"],
   "requests": ["月が消えたら", "..."]}

必要な環境変数: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
(トークンに https://www.googleapis.com/auth/youtube.force-ssl の権限が必要)

公開リポジトリに保存するため、投稿者の名前やチャンネルIDは保存しない。
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "comments"
INBOX = DIR / "inbox.json"
HANDLED = DIR / "handled.json"
REQUESTS = ROOT / "requests.md"
JST = timezone(timedelta(hours=9))

MAX_REPLIES = 10
MAX_LEN = 300
MAX_AGE_DAYS = 14


def yt():
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def load_handled() -> list[str]:
    return json.loads(HANDLED.read_text()) if HANDLED.exists() else []


def save_handled(ids: list[str]) -> None:
    DIR.mkdir(exist_ok=True)
    HANDLED.write_text(json.dumps(ids[-3000:], ensure_ascii=False, indent=0) + "\n")


def fetch() -> None:
    api = yt()
    me = api.channels().list(part="id", mine=True).execute()["items"][0]["id"]
    handled = set(load_handled())
    since = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    inbox, token = [], None
    for _ in range(4):  # 最大200件まで見る
        resp = api.commentThreads().list(
            part="snippet", allThreadsRelatedToChannelId=me, maxResults=50, order="time", textFormat="plainText", pageToken=token
        ).execute()
        for th in resp.get("items", []):
            top = th["snippet"]["topLevelComment"]
            sn = top["snippet"]
            published = datetime.fromisoformat(sn["publishedAt"].replace("Z", "+00:00"))
            if published < since:
                continue
            if top["id"] in handled or sn.get("authorChannelId", {}).get("value") == me:
                continue
            inbox.append({
                "id": top["id"],
                "video_id": th["snippet"].get("videoId", ""),
                "text": sn.get("textOriginal") or sn.get("textDisplay", ""),
                "likes": sn.get("likeCount", 0),
                "replies": th["snippet"].get("totalReplyCount", 0),
                "published": sn["publishedAt"],
            })
        token = resp.get("nextPageToken")
        if not token:
            break
    inbox.sort(key=lambda c: c["published"])
    DIR.mkdir(exist_ok=True)
    INBOX.write_text(json.dumps({"fetched_at": datetime.now(JST).isoformat(timespec="minutes"), "comments": inbox[:40]}, ensure_ascii=False, indent=1) + "\n")
    print(f"未対応のコメント: {len(inbox)}件")


def reply(plan_path: str) -> None:
    plan = json.loads(Path(plan_path).read_text())
    replies = plan.get("replies", [])[:MAX_REPLIES]
    handled = load_handled()
    api = yt()
    posted = 0
    for r in replies:
        text = (r.get("text") or "").strip()
        if not r.get("id") or not text:
            continue
        if len(text) > MAX_LEN or re.search(r"https?://|www\.", text):
            print(f"スキップ(長すぎる/リンクを含む): {r['id']}")
            continue
        try:
            api.comments().insert(part="snippet", body={"snippet": {"parentId": r["id"], "textOriginal": text}}).execute()
            posted += 1
        except HttpError as e:
            print(f"返信に失敗: {r['id']}: {e.status_code}")
            if e.status_code == 403:
                raise SystemExit("権限エラー: トークンに youtube.force-ssl の権限が必要です")
            continue
        handled.append(r["id"])
    handled.extend(i for i in plan.get("skip", []) if i not in handled)
    save_handled(handled)

    reqs = [q.strip() for q in plan.get("requests", []) if q and q.strip()]
    if reqs:
        existing = REQUESTS.read_text() if REQUESTS.exists() else "# 視聴者のリクエスト（自動で追記）\n\n"
        date = datetime.now(JST).strftime("%Y-%m-%d")
        for q in reqs:
            q = re.sub(r"[\r\n]+", " ", q)[:60]
            if q not in existing:
                existing += f"- {q}（{date}）\n"
        REQUESTS.write_text(existing)
    # 受信箱を空にする
    INBOX.write_text(json.dumps({"fetched_at": None, "comments": []}, ensure_ascii=False) + "\n")
    print(f"返信: {posted}件 / 対応済みに追加: {len(plan.get('skip', []))}件 / リクエスト: {len(reqs)}件")


DEFAULT_COMMENTS = [
    "次は何が消えたら見たい？思いついたの書いてって",
    "どこが一番ヤバいと思った？",
    "これ知ってた？知らなかったら🙋",
    "次のネタ募集中、コメントのやつから作るよ",
]


def post(video_id: str, script_path: str) -> None:
    """投稿した動画に、コメントを促すコメントを書き込む(固定は API では不可)。"""
    script = json.loads(Path(script_path).read_text())
    text = (script.get("comment") or "").strip()
    if not text or len(text) > MAX_LEN or re.search(r"https?://|www\.", text):
        day = int(datetime.now(JST).strftime("%j"))
        text = DEFAULT_COMMENTS[day % len(DEFAULT_COMMENTS)]
    resp = yt().commentThreads().insert(
        part="snippet", body={"snippet": {"videoId": video_id, "topLevelComment": {"snippet": {"textOriginal": text}}}}
    ).execute()
    print(f"コメントを投稿: {resp['id']} / {text}")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "post":
        post(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 2 and sys.argv[1] == "fetch":
        fetch()
    elif len(sys.argv) >= 3 and sys.argv[1] == "reply":
        reply(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)
