# かんたんツール箱を独自ドメインで公開する（社長の作業）

## なぜ新しいリポジトリに分けるのか
このリポジトリ（pachislo）の GitHub Pages に独自ドメインを付けると、`mmmtgn08.github.io/pachislo/` 全体がそのドメインに移ります。すると次の2つが起きます。
- **スロット収支アプリ（トップの index.html）に保存してある記録が見えなくなる**（ブラウザの保存場所がアドレスごとに分かれているため）
- YouTube・TikTok の認証で登録したプライバシーポリシー等のアドレスが変わる

そこで、ツールサイトだけを新しいリポジトリに置いて、そちらにドメインを付けます。

## 1. ドメインを買う（10分・年1,500円前後）
- おすすめ: **Cloudflare Registrar**（原価販売で更新料が上がらない。英語画面）
  - 日本語の画面がよければ お名前.com など（更新料が高めで、宣伝メールが多い）
- 名前の例（空いているかは購入画面で確認）: `kantan-toolbox.com` / `toolbako.com` / `kantantool.jp`
  - `.com` は年1,500円前後、`.jp` は年3,000〜4,000円前後
- 自動更新をオンにしておく（切れると、他人に取られることがある）

## 2. 新しいリポジトリを作る（2分）
1. GitHub で「New repository」
2. 名前の例: `kantan-tools`、**Public**、README などは**何も付けない**（空のまま）
3. Claude に「`mmmtgn08/kantan-tools` を作ったので、ツールサイトを移して。ドメインは `〇〇.com`」と伝える
   → Claude がサイト一式（ドメイン入りのサイトマップ等）を入れます

## 3. GitHub Pages を有効にする（Claude がサイトを入れたあと）
新しいリポジトリの Settings → Pages:
1. Source: **Deploy from a branch** / Branch: **main** / **/ (root)** → Save
2. Custom domain: 買ったドメイン（例: `toolbako.com`）→ Save
3. 数分〜1時間後に **Enforce HTTPS** にチェック

## 4. ドメインの DNS を設定する（買ったサービスの管理画面）
| 種類 | 名前 | 値 |
|---|---|---|
| A | `@`（ドメインそのもの） | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `mmmtgn08.github.io` |

- Cloudflare の場合、雲のマークは**オフ（DNS only）**にする
- 乗っ取り防止のため、GitHub の Settings（アカウント）→ Pages → **Add a domain** でドメインを確認しておく（TXT レコードを1つ追加するだけ）

## 5. 検索に載せる・広告を申し込む
1. **Google Search Console**（https://search.google.com/search-console）でドメインを追加 → DNS の TXT で確認 → 「サイトマップ」に `sitemap.xml` を送信
2. 1〜2週間して検索に出始めたら **Google AdSense** に申し込む
   - 審査用のコード（`<script ...>`）と `ads.txt` の中身が出たら Claude に渡す → Claude が全ページに入れます
   - 運営者情報・プライバシーポリシー（`about.html`）は作成済み
