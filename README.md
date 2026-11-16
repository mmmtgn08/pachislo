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
| `moshimo/requests.md` | 視聴者のリクエスト（任意。書いておくと優先して作る） |
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
