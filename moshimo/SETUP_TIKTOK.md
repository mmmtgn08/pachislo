# TikTok 同時投稿のセットアップ（社長の作業）

毎日のショートを、YouTube と同時に TikTok にも投稿します。
仕組みはできていて（`tools/tiktok.py` と `moshimo.yml` の「Upload to TikTok」）、**TikTok の認証情報を登録した日から自動で動きます**。登録するまでは何もしません。

## 1. TikTok の開発者アプリを作る（10分）
1. https://developers.tiktok.com/ に、投稿先の TikTok アカウントでログイン
2. 「Manage apps」→「Connect an app」でアプリを作る（名前の例: `pachislo-shorts`）
3. アプリの基本情報に入力:
   - App icon: 好きな画像（1024×1024）
   - Category: Entertainment
   - Description: `Posts my own auto-generated science short videos to my own TikTok account.`
   - Terms of Service URL: `https://mmmtgn08.github.io/pachislo/terms.html`
   - Privacy Policy URL: `https://mmmtgn08.github.io/pachislo/privacy.html`
   - Platforms: Web（Website URL は上のプライバシーポリシーのURLでよい）
4. 「Products」で次の2つを追加:
   - **Login Kit**: Redirect URI に `https://mmmtgn08.github.io/pachislo/tiktok-callback.html` を登録
   - **Content Posting API**: 「Direct Post」をオンにする
5. 「Scopes」で `user.info.basic` と `video.publish` を追加
6. 「Submit for review」で審査に出す
   - 使い方の説明（英語）: `I use this app only for my own account. Every day, my GitHub Actions workflow renders a short science animation and posts it to my TikTok account via the Content Posting API (Direct Post). The video is labeled as AI-generated.`
   - 審査には、アプリの動作を見せる短い画面録画を求められることがあります。必要なら Claude に頼んでください

> **審査に通るまでは「自分だけに公開（SELF_ONLY）」でしか投稿できません。** 先に下の 2 と 3 を済ませておけば、非公開で投稿されるかを確かめられます。

## 2. 認証情報を取る（5分）
アプリの画面に出る **Client key** と **Client secret** を使います。チャットには貼らないでください。

ご自身のパソコンで（Python が入っていれば）:
```
cd moshimo
export TIKTOK_CLIENT_KEY=（Client key）
python tools/tiktok.py auth-url
```
表示されたURLをブラウザで開き、TikTok で「許可」→ 戻ってきたページの **コードをコピー** → 数分以内に:
```
export TIKTOK_CLIENT_SECRET=（Client secret）
python tools/tiktok.py token （コピーしたコード）
```
最後に表示される長い文字列がリフレッシュトークンです。

## 3. GitHub に登録する
リポジトリの Settings → Secrets and variables → Actions:

| 種類 | 名前 | 値 |
|---|---|---|
| Secret | `TIKTOK_CLIENT_KEY` | Client key |
| Secret | `TIKTOK_CLIENT_SECRET` | Client secret |
| Secret | `TIKTOK_REFRESH_TOKEN` | 2 で出た文字列 |
| Variable | `TIKTOK_PRIVACY` | 審査前は登録しない（SELF_ONLY）。審査に通ったら `PUBLIC_TO_EVERYONE` |

## メモ
- リフレッシュトークンの有効期限は約1年。期限が近づいたら 2 をやり直して `TIKTOK_REFRESH_TOKEN` を更新する
- TikTok の収益化（Creator Rewards）は「1分以上の動画」が対象。今のショートは30〜45秒なので、伸びてきたら1分版を作るか相談してください
- 長尺動画（横長）は TikTok には投稿しません
