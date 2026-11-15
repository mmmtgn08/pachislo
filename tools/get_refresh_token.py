"""YouTube 投稿用のリフレッシュトークンを取得する(PCで1回だけ実行)。

1. Google Cloud Console で「OAuth クライアントID(デスクトップアプリ)」を作成し、
   JSON をダウンロードして client_secret.json としてこのフォルダに置く
2. pip install google-auth-oauthlib
3. python tools/get_refresh_token.py
4. ブラウザで投稿先チャンネルのアカウントを選んで許可
5. 表示された 3つの値を GitHub Secrets に登録
"""
import json
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

path = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "client_secret.json")
flow = InstalledAppFlow.from_client_secrets_file(str(path), SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
info = json.loads(path.read_text())
info = info.get("installed") or info.get("web")

print("\n以下を GitHub の Settings → Secrets and variables → Actions に登録してください:\n")
print(f"YT_CLIENT_ID      = {info['client_id']}")
print(f"YT_CLIENT_SECRET  = {info['client_secret']}")
print(f"YT_REFRESH_TOKEN  = {creds.refresh_token}")
