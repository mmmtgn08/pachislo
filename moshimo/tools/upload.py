"""YouTube Data API v3 で動画(ショート・長尺)をアップロードする。
メタデータに thumbnail があれば、サムネイルも設定する(電話番号で確認済みのチャンネルのみ可)。

  python tools/upload.py out/video.mp4 out/video.meta.json   → 動画IDを出力

必要な環境変数(GitHub Secrets):
  YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
任意:
  YT_PRIVACY  public / unlisted / private (既定 public)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def build_description(script: dict) -> str:
    credits = script.get("credits", [])
    tags = " ".join(f"#{t}" for t in script["tags"][:5])
    parts = [script.get("description", ""), "", tags, "", " / ".join(credits)]
    return "\n".join(parts).strip()[:4900]


def upload(video: Path, script: dict) -> str:
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=SCOPES,
    )
    yt = build("youtube", "v3", credentials=creds, cache_discovery=False)
    body = {
        "snippet": {
            "title": script["title"][:100],
            "description": build_description(script),
            "tags": script["tags"],
            "categoryId": "28",  # 科学と技術
            "defaultLanguage": "ja",
            "defaultAudioLanguage": "ja",
        },
        "status": {
            "privacyStatus": os.environ.get("YT_PRIVACY") or "public",
            "selfDeclaredMadeForKids": False,
        },
    }
    req = yt.videos().insert(part="snippet,status", body=body,
                             media_body=MediaFileUpload(str(video), mimetype="video/mp4", resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    vid = resp["id"]
    thumb = script.get("thumbnail")
    if thumb:
        path = video.parent / thumb
        try:
            yt.thumbnails().set(videoId=vid, media_body=MediaFileUpload(str(path), mimetype="image/png")).execute()
            print(f"サムネイルを設定しました: {path.name}", file=sys.stderr)
        except Exception as e:  # 未確認チャンネルなどでは失敗する。動画の投稿は成功しているので続ける
            print(f"::warning::サムネイルを設定できませんでした（YouTube のチャンネル確認が必要な場合があります）: {e}", file=sys.stderr)
    return vid


if __name__ == "__main__":
    import json
    import sys

    meta = json.load(open(sys.argv[2], encoding="utf-8"))
    vid = upload(Path(sys.argv[1]), meta)
    print(vid)
