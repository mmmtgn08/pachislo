"""再生が伸びないときの診断: 直近の動画とチャンネルの状態を YouTube API から取得して保存する。

  python tools/diagnose.py   → diagnostics.json

公開状態・処理状態・「子ども向け」判定(動画・チャンネル)・年齢制限・地域制限・長さ・画質などを見る。
視聴者の情報は取得しない。
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "diagnostics.json"
JST = timezone(timedelta(hours=9))


def main() -> None:
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
    )
    api = build("youtube", "v3", credentials=creds, cache_discovery=False)
    ch = api.channels().list(part="id,status,statistics,contentDetails,brandingSettings", mine=True).execute()["items"][0]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    items = api.playlistItems().list(part="contentDetails", playlistId=uploads, maxResults=15).execute().get("items", [])
    ids = [it["contentDetails"]["videoId"] for it in items]
    vids = api.videos().list(part="snippet,status,contentDetails,statistics", id=",".join(ids)).execute().get("items", [])
    out = {
        "checked_at": datetime.now(JST).isoformat(timespec="minutes"),
        "channel": {
            "status": ch.get("status", {}),
            "statistics": ch.get("statistics", {}),
            "default_language": ch.get("brandingSettings", {}).get("channel", {}).get("defaultLanguage"),
            "country": ch.get("brandingSettings", {}).get("channel", {}).get("country"),
        },
        "videos": [],
    }
    for v in vids:
        sn, st, cd = v["snippet"], v["status"], v["contentDetails"]
        out["videos"].append({
            "id": v["id"],
            "title": sn.get("title"),
            "published_at": sn.get("publishedAt"),
            "category": sn.get("categoryId"),
            "audio_language": sn.get("defaultAudioLanguage"),
            "live": sn.get("liveBroadcastContent"),
            "privacy": st.get("privacyStatus"),
            "upload_status": st.get("uploadStatus"),
            "failure_reason": st.get("failureReason"),
            "rejection_reason": st.get("rejectionReason"),
            "publish_at": st.get("publishAt"),
            "made_for_kids": st.get("madeForKids"),
            "self_declared_made_for_kids": st.get("selfDeclaredMadeForKids"),
            "embeddable": st.get("embeddable"),
            "license": st.get("license"),
            "duration": cd.get("duration"),
            "dimension": cd.get("dimension"),
            "definition": cd.get("definition"),
            "content_rating": cd.get("contentRating"),
            "region_restriction": cd.get("regionRestriction"),
            "licensed_content": cd.get("licensedContent"),
            "views": int(v.get("statistics", {}).get("viewCount", 0)),
            "likes": int(v.get("statistics", {}).get("likeCount", 0)),
            "comments": v.get("statistics", {}).get("commentCount"),
        })
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(out, ensure_ascii=False)[:3000])


if __name__ == "__main__":
    main()
