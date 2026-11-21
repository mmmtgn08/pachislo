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

# かんたんツール箱（`tools/`）

ブラウザだけで動く無料ツール集。GitHub Pages で公開し、アクセスが集まったら広告（Google AdSense）で収益化する。
ファイルや文章はブラウザの中だけで処理し、サーバーには送らない。

| ページ | 内容 |
|---|---|
| `tools/index.html` | ツール一覧 |
| `tools/moji-count/` | 文字数カウント（空白除外・原稿用紙・X の残り文字数・バイト数） |
| `tools/image-compress/` | 画像圧縮・リサイズ（複数枚・HEIC 対応） |
| `tools/image-convert/` | 画像の形式変換（HEIC→JPG、PNG/JPG/WebP） |
| `tools/exif-remove/` | 写真の位置情報（Exif）の確認と削除 |
| `tools/about.html` | 運営者情報・プライバシーポリシー（AdSense の審査に必要） |
| `tools/style.css` / `tools/img.js` | 共通の見た目 / 画像処理 |

広告を入れるときは、各ページの `<div class="ad-slot">` に広告コードを入れる。

# 再生数レポート（`moshimo/STATS.md`）

`moshimo-stats` ワークフローが毎朝 6:17（日本時間）に動画ごとの再生数を取得し、`moshimo/STATS.md` に収益化条件までの進み具合をまとめる。毎日の台本づくりもこのレポートを参考にする。
