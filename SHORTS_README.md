# ショート動画 自動生成システム

毎日、Claude が台本を書き、GitHub Actions が音声付きの縦動画を作って YouTube に投稿します。

```
[Claude Code 定期タスク 毎日17:47]          [GitHub Actions: daily-short.yml]
 GUIDE.md と過去の履歴を読む                 VOICEVOX(ずんだもん/四国めたん)で読み上げ
 → 今日の台本JSONを作成            ──起動──▶ テロップ画像を作って 1080x1920 動画に合成
 → ワークフローを起動                         YouTube に投稿 → history.jsonl に記録
```

| ファイル | 役割 |
|---|---|
| `content/GUIDE.md` | 編集方針・テーマ・禁止事項。**ここを書き換えると動画の中身が変わる** |
| `content/history.jsonl` | 投稿履歴（自動追記）。ネタ被り防止に使う |
| `content/scripts/` | 投稿した台本のアーカイブ（自動） |
| `content/DAILY_PROMPT.md` | 定期タスクに登録するプロンプト |
| `shorts/` | 動画生成・投稿のプログラム |
| `assets/bgm.mp3` | 置くと BGM として小さく流れる（著作権フリーのものを） |

## 初回セットアップ（1回だけ）

### 1. このブランチを main にマージ
ワークフローは main にないと起動できません。

### 2. YouTube の認証情報を作る
1. https://console.cloud.google.com/ でプロジェクトを作成
2. 「API とサービス」→「ライブラリ」で **YouTube Data API v3** を有効化
3. 「OAuth 同意画面」を作成（ユーザーの種類: 外部）。テストユーザーに自分のGoogleアカウントを追加
   - **作成後「アプリを公開」で「本番環境」にする**（テストのままだと7日でトークンが失効して止まります。個人利用なら審査なしで使えます）
4. 「認証情報」→「OAuth クライアントID」を作成し、リフレッシュトークンを取得する。方法は2つ:
   - **PCがある場合**: 種類「デスクトップアプリ」で作成 → JSONを `tools/client_secret.json` に保存 →
     `pip install google-auth-oauthlib && python tools/get_refresh_token.py`
   - **スマホだけの場合**: 種類「ウェブアプリケーション」、承認済みリダイレクトURIに
     `https://developers.google.com/oauthplayground` を追加して作成 →
     https://developers.google.com/oauthplayground を開き、右上の歯車で「Use your own OAuth credentials」にクライアントID/シークレットを入力 →
     スコープに `https://www.googleapis.com/auth/youtube.upload` を入力して Authorize → 「Exchange authorization code for tokens」→ Refresh token をコピー

### 3. GitHub に登録
リポジトリの Settings → Secrets and variables → Actions
- **Secrets**: `YT_CLIENT_ID` / `YT_CLIENT_SECRET` / `YT_REFRESH_TOKEN`
- **Variables**（任意）: `CHANNEL_NAME`（動画下部に表示）、`YT_PRIVACY`（`public`/`unlisted`/`private`）

### 4. テスト
Actions タブ → daily-short → Run workflow（サンプル台本で実行）。
完了画面の Artifacts から動画をダウンロードして確認できます。サンプル実行は履歴に記録されません。

### 5. 定期タスクを登録
Claude Code に「定期タスクを登録して」と伝えると `content/DAILY_PROMPT.md` の内容で毎日実行されます。

## 注意点
- **公開状態の制限**: YouTube の仕様で、未審査の Google Cloud プロジェクトから API 投稿した動画は「非公開」に固定されます。
  自動で公開まで行うには、Google の [YouTube API 監査フォーム](https://support.google.com/youtube/contact/yt_api_form) の申請（無料）が必要です。
  承認までは、YouTube Studio アプリで非公開→公開に切り替えてください（1タップ）。
- **収益化**: テンプレートだけで量産した動画は「繰り返しの多いコンテンツ」と判断されることがあります。GUIDE.md でネタの幅を広げたり、ときどき自分の実戦ネタを混ぜたりすると安全です。
- **VOICEVOX のクレジット**: 概要欄に「VOICEVOX:ずんだもん」等を自動で記載しています（利用規約上必須）。
- **API の上限**: 1日あたり約6本までアップロード可能（無料枠 10,000 ユニット、1本 1,600）。

## ローカルで試す
```
pip install -r requirements.txt
python -m shorts.schema content/examples/sample.json          # 台本チェック
python -m shorts.build content/examples/sample.json --tts dummy   # 仮の音で動画を作る
```
VOICEVOX を起動していれば `--tts dummy` を外すと音声付きになります。
