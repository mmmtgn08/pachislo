"""TikTok Content Posting API で、ショートを運営者本人の TikTok アカウントに投稿する。

  python tools/tiktok.py auth-url                 # 認可ページのURLを表示（最初の1回だけ）
  python tools/tiktok.py token <code>             # 認可コードからリフレッシュトークンを取得（最初の1回だけ）
  python tools/tiktok.py upload <video.mp4> <video.meta.json>   # 投稿して publish_id を出力

必要な環境変数: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
  upload では TIKTOK_REFRESH_TOKEN も必要
任意:
  TIKTOK_REDIRECT_URI  アプリに登録したリダイレクトURI（既定は GitHub Pages の tiktok-callback.html）
  TIKTOK_PRIVACY       PUBLIC_TO_EVERYONE / MUTUAL_FOLLOW_FRIENDS / FOLLOWER_OF_CREATOR / SELF_ONLY
                       （既定 SELF_ONLY。TikTok の審査に通るまでは SELF_ONLY でしか投稿できない）

標準ライブラリだけで動く。
"""
from __future__ import annotations

import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://open.tiktokapis.com"
AUTH = "https://www.tiktok.com/v2/auth/authorize/"
SCOPES = "user.info.basic,video.publish"
DEFAULT_REDIRECT = "https://mmmtgn08.github.io/pachislo/tiktok-callback.html"
MAX_SINGLE_CHUNK = 64 * 1024 * 1024


def env(name: str) -> str:
    v = os.environ.get(name, "")
    if not v:
        sys.exit(f"環境変数 {name} がありません")
    return v


def call(method: str, url: str, *, token: str | None = None, data: dict | None = None, form: dict | None = None) -> dict:
    headers = {}
    body = None
    if form is not None:
        body = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json; charset=UTF-8"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"TikTok API エラー {e.code}: {e.read().decode(errors='replace')[:500]}")
    err = resp.get("error")
    if isinstance(err, dict) and err.get("code") not in (None, "", "ok"):
        raise SystemExit(f"TikTok API エラー: {err.get('code')} {err.get('message')}")
    if "error" in resp and isinstance(resp["error"], str):  # OAuth のエラー形式
        raise SystemExit(f"TikTok 認証エラー: {resp.get('error')} {resp.get('error_description')}")
    return resp


def auth_url() -> None:
    q = {
        "client_key": env("TIKTOK_CLIENT_KEY"),
        "scope": SCOPES,
        "response_type": "code",
        "redirect_uri": os.environ.get("TIKTOK_REDIRECT_URI") or DEFAULT_REDIRECT,
        "state": secrets.token_urlsafe(12),
    }
    print(AUTH + "?" + urllib.parse.urlencode(q))


def exchange(code: str) -> None:
    resp = call("POST", f"{API}/v2/oauth/token/", form={
        "client_key": env("TIKTOK_CLIENT_KEY"),
        "client_secret": env("TIKTOK_CLIENT_SECRET"),
        "code": urllib.parse.unquote(code),
        "grant_type": "authorization_code",
        "redirect_uri": os.environ.get("TIKTOK_REDIRECT_URI") or DEFAULT_REDIRECT,
    })
    print("スコープ:", resp.get("scope"))
    print("リフレッシュトークン（GitHub の Secrets に TIKTOK_REFRESH_TOKEN として登録する）:")
    print(resp["refresh_token"])


def access_token() -> str:
    old = env("TIKTOK_REFRESH_TOKEN")
    resp = call("POST", f"{API}/v2/oauth/token/", form={
        "client_key": env("TIKTOK_CLIENT_KEY"),
        "client_secret": env("TIKTOK_CLIENT_SECRET"),
        "grant_type": "refresh_token",
        "refresh_token": old,
    })
    if resp.get("refresh_token") and resp["refresh_token"] != old:
        print("::warning::TikTok のリフレッシュトークンが新しくなりました。期限切れの前に tools/tiktok.py で取り直して "
              "Secrets の TIKTOK_REFRESH_TOKEN を更新してください", file=sys.stderr)
    return resp["access_token"]


def caption(meta: dict) -> str:
    title = meta.get("title", "").replace("#shorts", "").strip()
    tags = " ".join(f"#{t}" for t in meta.get("tags", []) if t.lower() != "shorts")
    return f"{title}\n{meta.get('description', '')}\n{tags}".strip()[:2200]


def upload(video: Path, meta: dict) -> str:
    token = access_token()
    info = call("POST", f"{API}/v2/post/publish/creator_info/query/", token=token, data={})["data"]
    options = info.get("privacy_level_options") or ["SELF_ONLY"]
    privacy = os.environ.get("TIKTOK_PRIVACY") or "SELF_ONLY"
    if privacy not in options:
        print(f"::warning::公開範囲 {privacy} は使えないため SELF_ONLY で投稿します（使える範囲: {', '.join(options)}）", file=sys.stderr)
        privacy = "SELF_ONLY"
    max_sec = info.get("max_video_post_duration_sec")
    if max_sec and meta.get("seconds") and meta["seconds"] > max_sec:
        raise SystemExit(f"動画が長すぎます（{meta['seconds']}秒 > {max_sec}秒）")

    size = video.stat().st_size
    if size > MAX_SINGLE_CHUNK:
        raise SystemExit("64MB を超える動画には対応していません")
    init = call("POST", f"{API}/v2/post/publish/video/init/", token=token, data={
        "post_info": {
            "title": caption(meta),
            "privacy_level": privacy,
            "disable_duet": False,
            "disable_comment": bool(info.get("comment_disabled")),
            "disable_stitch": False,
            "is_aigc": True,  # AI で作った動画であることを表示する（TikTok のルール）
        },
        "source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1},
    })["data"]
    req = urllib.request.Request(init["upload_url"], data=video.read_bytes(), method="PUT", headers={
        "Content-Type": "video/mp4",
        "Content-Length": str(size),
        "Content-Range": f"bytes 0-{size - 1}/{size}",
    })
    with urllib.request.urlopen(req, timeout=300):
        pass
    publish_id = init["publish_id"]
    # 処理の完了を待つ（最大3分）
    for _ in range(36):
        time.sleep(5)
        st = call("POST", f"{API}/v2/post/publish/status/fetch/", token=token, data={"publish_id": publish_id})["data"]
        status = st.get("status")
        if status in ("PUBLISH_COMPLETE", "SEND_TO_USER_INBOX"):
            print(f"TikTok: {status}（公開範囲 {privacy}）", file=sys.stderr)
            break
        if status == "FAILED":
            raise SystemExit(f"TikTok の処理に失敗しました: {st.get('fail_reason')}")
    else:
        print("::warning::TikTok の処理がまだ終わっていません（あとで反映される場合があります）", file=sys.stderr)
    return publish_id


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "auth-url":
        auth_url()
    elif cmd == "token" and len(sys.argv) == 3:
        exchange(sys.argv[2])
    elif cmd == "upload" and len(sys.argv) == 4:
        print(upload(Path(sys.argv[2]), json.load(open(sys.argv[3], encoding="utf-8"))))
    else:
        sys.exit(__doc__)
