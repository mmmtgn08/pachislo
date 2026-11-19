# もしも3Dショート 自動生成

毎日、Claude が「もしも〇〇が消えたら」の台本を書き、GitHub Actions が 3D アニメのショート動画を作って YouTube に投稿します。

```
[Claude Code 定期タスク]                 [GitHub Actions: moshimo.yml]
 moshimo/GUIDE.md と履歴を読む            VOICEVOX(青山龍星)でナレーション
 → 今日の台本JSONを作成        ──起動──▶  Remotion + React Three Fiber で 3D 動画を描画
 → ワークフローを起動                      YouTube に投稿 → moshimo/history.jsonl に記録
```

| ファイル | 役割 |
|---|---|
| `moshimo/GUIDE.md` | 編集方針・事実のルール・使えるシーン一覧。**ここを書き換えると動画の中身が変わる** |
| `moshimo/DAILY_PROMPT.md` | 定期タスクに登録するプロンプト |
| `moshimo/history.jsonl` | 投稿履歴（自動追記） |
| `moshimo/requests.md` | 視聴者のリクエスト（コメントから自動で追記。手で書いてもOK） |
| `moshimo/COMMENTS.md` | コメント返信のルール |
| `moshimo/comments/` | 未対応コメントの受信箱と対応済みID（投稿者名は保存しない） |
| `moshimo/topics/` | 台本の例と、投稿した台本のアーカイブ（`posted/`） |
| `moshimo/src/` | 3D シーンと画面の演出（Remotion） |
| `moshimo/scripts/render.mjs` | 台本 → ナレーション → 動画 |
| `moshimo/tools/` | 効果音・BGM の合成（著作権フリー）、YouTube 投稿、トークン取得 |

## セットアップ
1. GitHub の Settings → Secrets and variables → Actions に登録（登録済み）
   - `YT_CLIENT_ID` / `YT_CLIENT_SECRET` / `YT_REFRESH_TOKEN`（投稿先チャンネルのトークン）
   - Variables（任意）: `MOSHIMO_YT_PRIVACY`（`public` / `unlisted` / `private`）
2. 投稿先チャンネルを変えるときは、OAuth Playground でそのチャンネルのアカウントを選び直して `YT_REFRESH_TOKEN` を更新する
3. Actions → moshimo → Run workflow でテスト（`dry_run: true` なら投稿しない）
4. コメント返信を使うには、トークンに `youtube.upload` と `youtube.force-ssl` の2つの権限が必要

## ローカルで試す
```
cd moshimo
npm ci
npx remotion studio src/index.ts                                   # ブラウザでプレビュー
node scripts/render.mjs topics/gravity.json --tts dummy --out out/test.mp4
```

## 注意
- 未審査の Google Cloud プロジェクトから投稿した動画は「非公開」に固定されます。自動で公開するには YouTube API の監査申請が必要です
- 概要欄に「VOICEVOX:青山龍星」のクレジットを自動記載しています
- BGM は毎回プログラムで合成しています（動画ごとにテンポ・コード進行・音色が変わる）。音量はリポジトリ変数ではなく `BGM_VOLUME`（既定 0.15）で調整できます
- `index.html`（スロット収支アプリ）と `privacy.html`（OAuth 用プライバシーポリシー）は GitHub Pages で公開しています

---

# いきもの雑学ショート（実写・新チャンネル） `doubutsu/`

動物・自然の実話の雑学を、無料の実写素材（Pixabay / Pexels）で毎日ショートにして、**もしもとは別のチャンネル**に投稿します。費用は Claude 以外かかりません。

```
[Claude Code 定期タスク]                 [GitHub Actions: doubutsu.yml]
 doubutsu/GUIDE.md と履歴を読む           VOICEVOX(春日部つむぎ)でナレーション
 → 台本JSON(英語の素材検索語つき)  ─▶   Pexels/Pixabay から実写動画を検索・取得 → 縦型に切り抜き
 → ワークフローを起動                      Remotion で字幕・カウンター・BGM → 新チャンネルに投稿
```

| ファイル | 役割 |
|---|---|
| `doubutsu/GUIDE.md` | 編集方針・事実のルール・素材検索のルール |
| `doubutsu/DAILY_PROMPT.md` | 定期タスクに登録するプロンプト |
| `doubutsu/history.jsonl` | 投稿履歴（自動追記） |
| `doubutsu/topics/tako.json` | 台本の例 |
| `doubutsu/scripts/render.mjs` | 台本 → ナレーション → 素材取得 → 動画 |
| `doubutsu/src/Main.tsx` | 画面の演出（字幕・カウンター・ズーム） |

効果音・BGM・投稿・コメントのスクリプトは `moshimo/tools/` を共用しています。

## セットアップ（すべて無料）
1. 新しい YouTube チャンネルを作る（同じ Google アカウントの「ブランドアカウント」で作ると、今の OAuth クライアントをそのまま使えます）
2. https://pixabay.com/ で無料登録し、https://pixabay.com/api/docs/ に表示される API キーを控える（Pexels は新規キーの発行を一時停止中。再開したら追加すると素材が増える）
3. `python moshimo/tools/get_refresh_token.py` を実行し、ブラウザで**新チャンネル**を選んで許可
4. GitHub の Settings → Secrets and variables → Actions に登録
   - `PIXABAY_API_KEY`（必須） / `PEXELS_API_KEY`（任意。取れたら追加）
   - `YT2_REFRESH_TOKEN`（新チャンネルのトークン。**`YT_REFRESH_TOKEN` は上書きしない**）
   - 別の OAuth クライアントを使うときだけ `YT2_CLIENT_ID` / `YT2_CLIENT_SECRET`
   - Variables（任意）: `DOUBUTSU_YT_PRIVACY`
5. Actions → doubutsu → Run workflow（`dry_run: true`, `preview: true`）でテスト

## ローカルで試す（APIキーなし）
```
cd doubutsu
npm ci
node scripts/render.mjs topics/tako.json --tts dummy --clips dummy --out out/test.mp4
```
