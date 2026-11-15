"""YouTube Data API v3 でショートをアップロードする。

必要な環境変数(GitHub Secrets):
  YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
任意:
  YT_PRIVACY  public / unlisted / private (既定 public)
"""
from __future__ import annotations

import os
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from .schema import SPEAKERS

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def build_description(script: dict) -> str:
    credits = sorted({SPEAKERS[l["speaker"]]["credit"] for l in script["lines"]})
    tags = " ".join(f"#{t}" for t in script["tags"][:5])
    parts = [script["description"], "", tags, "", "※パチンコ・パチスロは18歳になってから。適度に楽しむ遊びです。", "", " / ".join(credits)]
    return "\n".join(p for p in parts if p is not None).strip()[:4900]


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
            "categoryId": "24",  # エンターテイメント
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
    return resp["id"]
