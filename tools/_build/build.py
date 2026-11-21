"""かんたんツール箱のページを生成する: python3 _build/build.py
各ツールの HTML・一覧・運営者情報・sitemap.xml・robots.txt を書き出す。
CNAME（独自ドメイン）があれば canonical と sitemap に使う。
"""
import json, os, re
from pathlib import Path
ROOT = str(Path(__file__).resolve().parent.parent)
CNAME = Path(ROOT, "CNAME")
DOMAIN = CNAME.read_text().strip() if CNAME.exists() else ""
SITE = f"https://{DOMAIN}/" if DOMAIN else ""
PAGES = []  # (slug, h1, 一覧用の説明, 分類)

HEAD = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
{canonical}<link rel="stylesheet" href="../style.css">
<script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="site-header"><div class="inner"><a class="logo" href="../">かんたん<span>ツール箱</span></a><nav><a href="../">ツール一覧</a></nav></div></header>
<main>
"""
FOOT = """</main>
<footer><a href="../">ツール一覧</a><a href="../about.html">運営者情報・プライバシー</a><br>ファイルや文章はお使いのブラウザの中だけで処理され、サーバーには送信されません。</footer>
{scripts}
</body>
</html>
"""

def ld(name, desc, faq):
    data = [{"@context": "https://schema.org", "@type": "WebApplication", "name": name, "description": desc,
             "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any", "inLanguage": "ja",
             "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"}},
            {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]
    return json.dumps(data, ensure_ascii=False)

def faq_html(faq):
    return '<h2>よくある質問</h2>\n<dl class="faq">\n' + "\n".join(f"<dt>{q}</dt><dd>{a}</dd>" for q, a in faq) + "\n</dl>\n"

def page(slug, title, h1, desc, body, faq, scripts, card="", group="画像"):
    os.makedirs(f"{ROOT}/{slug}", exist_ok=True)
    PAGES.append((slug, h1, card or desc, group))
    canonical = f'<link rel="canonical" href="{SITE}{slug}/">\n' if SITE else ""
    html = HEAD.format(title=title, desc=desc, ld=ld(h1, desc, faq), canonical=canonical) + body + faq_html(faq) + FOOT.format(scripts=scripts)
    open(f"{ROOT}/{slug}/index.html", "w").write(html)

DROP = """<div class="card">
<div id="drop" class="drop" tabindex="0" role="button" aria-label="画像を選ぶ">
<strong>ここに画像をドロップ</strong>
<small>またはタップして選ぶ（複数OK・貼り付けもOK）／ {formats}</small>
</div>
<input id="file" type="file" accept="image/*,.heic,.heif" multiple hidden>
<div class="options">
{options}
</div>
<ul id="files" class="files"></ul>
<div class="row" style="margin-top:12px"><button id="saveAll" hidden>すべて保存</button></div>
</div>
<div class="ad-slot" data-ad="tool"></div>
"""
QUALITY = '<label><span>画質 <b id="qualityLabel"></b>%（低いほど軽くなる）</span><input id="quality" type="range" min="30" max="100" value="{q}"></label>'
MAXW = """<label>横幅の上限<select id="maxW"><option value="0">変えない</option><option value="3840">3840px（4K）</option><option value="1920"{s1920}>1920px（フルHD）</option><option value="1280">1280px（ブログ・SNS向け）</option><option value="800">800px（メール向け）</option><option value="400">400px（アイコン向け）</option></select></label>"""
FMT = """<label>保存する形式<select id="format">{keep}<option value="image/jpeg"{j}>JPG（写真向け・一番使える）</option><option value="image/png">PNG（文字・図・透明）</option><option value="image/webp"{w}>WebP（軽い・Web向け）</option></select></label>"""
FMTS = "JPG・PNG・WebP・HEIC（iPhone）"

def img_script(mode):
    return f'<script>window.IMG_TOOL = {{mode: "{mode}"}};</script>\n<script src="../decode.js"></script>\n<script src="../img.js"></script>'

# 画像圧縮
page("image-compress",
     "画像圧縮・リサイズ（無料・登録不要・まとめてOK）｜かんたんツール箱",
     "画像圧縮・リサイズ",
     "写真やスクリーンショットの容量をブラウザだけで小さくします。JPG・PNG・WebP・iPhoneのHEICに対応。サイズ指定のリサイズ、複数枚の一括処理もできます。画像はサーバーに送信されません。",
     f"""<span class="badge">無料・登録不要・アップロードなし</span>
<h1>画像圧縮・リサイズ</h1>
<p class="lead">写真の容量を小さくして、メール添付・ブログ・SNS・フォームのサイズ制限に合わせます。画像はお使いの端末の中だけで処理します。</p>
""" + DROP.format(formats=FMTS, options=QUALITY.format(q=75) + MAXW.format(s1920=" selected") + FMT.format(keep='<option value="keep" selected>元と同じ（HEICはJPG）</option>', j="", w="")) + """
<h2>使い方</h2>
<ol>
<li>画像をドロップするか、枠をタップして選びます（何枚でもまとめて選べます）。</li>
<li>すぐに圧縮され、元のサイズと圧縮後のサイズが表示されます。</li>
<li>「保存」で1枚ずつ、「すべて保存」でまとめて保存します。</li>
</ol>
<p>画質や横幅を変えると、入れた画像がすべて新しい設定で処理し直されます。ちょうどよい大きさになるまで調整できます。</p>

<h2>どのくらい小さくなる？</h2>
<p>スマホで撮った写真（3〜5MB程度）は、横幅1920px・画質75%にすると、多くの場合 300KB〜800KB ほどになります。横幅を1280pxにすると、さらに半分ほどになります。画面で見る分には違いがほとんどわからない大きさです。</p>
<p>PNG のスクリーンショットは、形式を「JPG」か「WebP」に変えると大きく軽くなります。文字や線をくっきり残したいときは PNG のまま横幅を小さくしてください。</p>
""",
     [("画像はどこかにアップロードされますか？", "いいえ。圧縮はお使いのブラウザの中だけで行い、画像がサーバーに送られることはありません。通信のない状態でも、ページを開いたあとなら動きます。"),
      ("iPhone の HEIC 写真も使えますか？", "使えます。HEIC の写真は JPG に変換して圧縮します。"),
      ("何枚まで一度に処理できますか？", "枚数の制限はありません。ただし端末のメモリによっては、とても大きな画像を大量に入れると時間がかかります。"),
      ("圧縮すると写真の位置情報は消えますか？", "はい。保存し直す仕組みのため、位置情報や撮影日時などの写真の情報は残りません。"),
      ("元より大きくなることはありますか？", "すでに十分小さい画像では起きることがあります。その場合は元のファイルをそのまま保存できるようにしています。")],
     img_script("compress"), card="写真の容量を小さく。メール添付やフォームのサイズ制限に。まとめて処理OK", group="画像")

# 形式変換
page("image-convert",
     "HEIC→JPG・PNG→JPG・WebP変換（無料・登録不要）｜かんたんツール箱",
     "画像の形式変換（HEIC・JPG・PNG・WebP）",
     "iPhoneのHEIC写真をJPGに、PNGをJPGに、WebPをPNGになど、画像の形式をブラウザだけで変換します。複数枚の一括変換に対応。画像はサーバーに送信されません。",
     f"""<span class="badge">無料・登録不要・アップロードなし</span>
<h1>画像の形式変換（HEIC・JPG・PNG・WebP）</h1>
<p class="lead">iPhone の HEIC 写真を JPG に、WebP を PNG に、PNG を JPG に。開けない・送れない画像を、よく使われる形式に変えます。</p>
""" + DROP.format(formats=FMTS, options=FMT.format(keep="", j=" selected", w="") + QUALITY.format(q=92) + MAXW.format(s1920="")) + """
<h2>使い方</h2>
<ol>
<li>「保存する形式」を選びます（迷ったら JPG）。</li>
<li>画像をドロップするか、枠をタップして選びます。</li>
<li>変換された画像を「保存」します。</li>
</ol>

<h2>どの形式を選べばいい？</h2>
<dl class="faq">
<dt>JPG（ジェイペグ）</dt><dd>写真向け。ほぼすべてのパソコン・スマホ・Webサービスで開けます。迷ったらこれ。透明な部分は白になります。</dd>
<dt>PNG（ピング）</dt><dd>スクリーンショット・図・ロゴ向け。文字がくっきり残り、透明な背景も保てます。写真だと容量が大きくなります。</dd>
<dt>WebP（ウェッピー）</dt><dd>Web向けの新しい形式。JPG より軽くなりますが、古いソフトでは開けないことがあります。</dd>
<dt>HEIC（ヒーク）</dt><dd>iPhone の標準の写真形式。Windows や一部のサービスで開けないため、JPG への変換がよく使われます（このツールでは読み込みのみ対応）。</dd>
</dl>
""",
     [("HEIC を JPG に変換すると画質は落ちますか？", "画質 92% 前後なら、見た目の違いはほとんどわかりません。少しでも劣化を避けたいときは画質を 100% にしてください（容量は大きくなります）。"),
      ("画像はアップロードされますか？", "いいえ。変換はお使いのブラウザの中だけで行います。"),
      ("HEIC の変換に時間がかかるのはなぜ？", "Safari 以外のブラウザでは、HEIC を読むための部品を最初の1回だけ読み込むためです。2枚目からは速くなります。"),
      ("動く GIF は変換できますか？", "1枚目の画像だけが静止画として変換されます。"),
      ("JPG や HEIC を PNG にすると容量が増えるのはなぜ？", "PNG は画質を落とさない形式のため、写真では容量が大きくなります。写真なら JPG か WebP がおすすめです。")],
     img_script("convert"), card="iPhone の HEIC を JPG に。PNG・JPG・WebP の相互変換", group="画像")

# 位置情報削除
page("exif-remove",
     "写真の位置情報（GPS・Exif）を削除（無料・登録不要）｜かんたんツール箱",
     "写真の位置情報（Exif）削除",
     "写真に記録された位置情報（GPS）・撮影日時・機種などのExif情報を、ブラウザだけで確認して削除します。SNSやフリマに載せる前の自宅バレ対策に。画像はサーバーに送信されません。",
     f"""<span class="badge">無料・登録不要・アップロードなし</span>
<h1>写真の位置情報（Exif）削除</h1>
<p class="lead">スマホの写真には、撮った場所（GPS）や日時が記録されていることがあります。SNS・ブログ・フリマアプリに載せる前に、残っている情報を確認して消せます。</p>
""" + DROP.format(formats=FMTS, options=FMT.format(keep='<option value="keep" selected>元と同じ（HEICはJPG）</option>', j="", w="") + QUALITY.format(q=95)) + """
<div class="note">写真をこのページに入れると、残っていた情報（位置情報・機種・撮影日時）を表示し、それらを含まない画像を作ります。写真はお使いの端末から外に出ません。</div>

<h2>写真に残っている情報とは</h2>
<p>スマホやデジカメの写真には「Exif（イグジフ）」という情報が一緒に保存されます。設定によっては、撮影した場所の緯度・経度まで記録されます。自宅で撮った写真をそのまま公開すると、住んでいる場所が分かってしまうおそれがあります。</p>
<p>多くの SNS は投稿時に位置情報を自動で消しますが、ブログ・メール・ファイル共有・一部のサービスでは残ったまま届くことがあります。心配なときは、公開前にこのページで消しておくと安心です。</p>

<h2>これから撮る写真に位置情報を残さない設定</h2>
<ul>
<li><b>iPhone</b>: 「設定」→「プライバシーとセキュリティ」→「位置情報サービス」→「カメラ」→「なし」</li>
<li><b>Android</b>: カメラアプリの設定で「位置情報タグ」「位置情報を保存」をオフ（機種によって名前が違います）</li>
</ul>
""",
     [("本当に位置情報は消えますか？", "はい。画像を描き直して保存するため、位置情報・撮影日時・機種などの Exif 情報は新しい画像にまったく含まれません。"),
      ("画質は落ちますか？", "画質 95% で保存するため、見た目の違いはほとんどありません。PNG を選ぶと画質は落ちません。"),
      ("写真はどこかに送られますか？", "いいえ。処理はすべてお使いのブラウザの中で行います。"),
      ("PNG や HEIC の写真でも消せますか？", "消せます。残っていた情報の表示は JPG のみ対応ですが、どの形式でも情報を含まない画像として保存します。")],
     img_script("exif"), card="SNS やフリマに載せる前に、GPS・撮影日時・機種の情報を確認して削除", group="画像")

# 文字数カウント
page("moji-count",
     "文字数カウント（原稿用紙換算・X/Twitter・空白除外）｜かんたんツール箱",
     "文字数カウント",
     "入力した文章の文字数をリアルタイムで数えます。空白・改行を除いた文字数、原稿用紙換算、X（Twitter）の残り文字数、バイト数、読む時間の目安まで一度に表示。文章はサーバーに送信されません。",
     """<span class="badge">無料・登録不要・入力内容は送信されません</span>
<h1>文字数カウント</h1>
<p class="lead">レポート・ES（エントリーシート）・ブログ・SNS 投稿の文字数を、入力しながら数えます。</p>
<div class="card">
<textarea id="text" placeholder="ここに文章を入力、または貼り付け" aria-label="文章"></textarea>
<div class="stats">
<div class="stat main"><div class="k">文字数（空白・改行込み）</div><div class="v" id="all">0</div></div>
<div class="stat main"><div class="k">空白・改行を除く</div><div class="v" id="noSpace">0</div></div>
<div class="stat"><div class="k">改行だけ除く</div><div class="v" id="noBreak">0</div></div>
<div class="stat"><div class="k">行数 / 段落数</div><div class="v"><span id="lines">0</span> / <span id="paras">0</span></div></div>
<div class="stat"><div class="k">原稿用紙（400字詰）</div><div class="v"><span id="genko">0</span>枚 <small id="genkoLines" style="font-size:13px;font-weight:400"></small></div></div>
<div class="stat"><div class="k">読む時間の目安</div><div class="v" id="read">0秒</div></div>
<div class="stat"><div class="k">X（Twitter）残り</div><div class="v" id="x">280</div></div>
<div class="stat"><div class="k">全角 / 半角</div><div class="v"><span id="zen">0</span> / <span id="han">0</span></div></div>
<div class="stat"><div class="k">バイト数（UTF-8 / Shift_JIS）</div><div class="v"><span id="utf8">0</span> / <span id="sjis">0</span></div></div>
</div>
<div class="row">
<label>目標の文字数 <input id="goal" type="number" min="0" step="50" placeholder="例: 400" style="width:110px"></label>
<span id="goalText" style="font-size:14px;color:var(--muted)"></span>
</div>
<div class="bar" id="goalBar" hidden style="margin-top:8px"><i></i></div>
<div class="row" style="margin-top:14px">
<button id="copy" class="ghost">文章をコピー</button>
<button id="clear" class="ghost">消す</button>
<small style="color:var(--muted)">入力中の文章はこの端末にだけ自動で保存されます。</small>
</div>
</div>
<div class="ad-slot" data-ad="tool"></div>

<h2>数え方について</h2>
<ul>
<li><b>文字数</b>: 絵文字や「が」のような濁点つきの文字も、見た目どおり1文字として数えます。</li>
<li><b>空白・改行を除く</b>: 全角・半角のスペース、タブ、改行を数えません。ES や課題で「空白を含まない」と指定されたときに使います。</li>
<li><b>原稿用紙</b>: 1行20字・20行の400字詰めとして、段落ごとに改行した場合の行数から計算します（句読点のぶら下げなど細かい決まりは含みません）。</li>
<li><b>X（Twitter）</b>: 日本語などの全角文字は2、半角英数字は1として数え、280 までの残りを表示します。URL は 23 として数えます。全角だけなら 140 文字です。</li>
<li><b>読む時間</b>: 1分間に約500字として計算した目安です。</li>
</ul>
""",
     [("入力した文章はどこかに送られますか？", "いいえ。数えるのはお使いのブラウザの中だけで、文章がサーバーに送られることはありません。"),
      ("Word の文字数と違うのはなぜ？", "Word は半角英単語を「単語」としてまとめて数えるなど、数え方が違うことがあります。このツールは1文字ずつ数えます。"),
      ("原稿用紙の枚数が手書きと少し違います", "句読点を行の最後にぶら下げる、かぎかっこの扱いなど、手書きの細かい決まりまでは再現していません。目安としてお使いください。"),
      ("X（Twitter）で全角140文字というのは？", "X は半角英数字を1、日本語などの全角文字を2として、合計280までを1回の投稿にできます。そのため全角だけだと140文字です。")],
     '<script src="count.js"></script>', card="空白除外・原稿用紙換算・X（Twitter）の残り文字数・バイト数をまとめて表示", group="文章")


# ───────── PDF ─────────
PDF_DROP = """<div class="card">
<div id="drop" class="drop" tabindex="0" role="button" aria-label="{aria}">
<strong>{strong}</strong>
<small>{small}</small>
</div>
<input id="file" type="file" accept="{accept}" {multi} hidden>
<ul id="files" class="files"></ul>
{opts}
<div class="row" style="margin-top:12px"><button id="run" disabled>{run}</button></div>
<div id="out" class="out"></div>
</div>
<div class="ad-slot" data-ad="tool"></div>
"""
def pdf_script(mode, img=False):
    return (f'<script src="../vendor/pdf-lib.min.js"></script>\n' + ('<script src="../decode.js"></script>\n' if img else '')
            + f'<script>window.PDF_TOOL = {{mode: "{mode}"}};</script>\n<script src="../pdf.js"></script>')

page("pdf-merge",
     "PDF結合（無料・登録不要・アップロードなし）｜かんたんツール箱",
     "PDF結合",
     "複数のPDFファイルを1つにまとめます。順番の並べ替えもかんたん。ファイルはブラウザの中だけで処理し、サーバーに送信しないので、契約書や書類も安心して扱えます。",
     """<span class="badge">無料・登録不要・アップロードなし</span>
<h1>PDF結合</h1>
<p class="lead">複数の PDF を1つのファイルにまとめます。書類はお使いの端末から外に出ないので、見積書・契約書・申請書類にも使えます。</p>
""" + PDF_DROP.format(aria="PDFを選ぶ", strong="ここにPDFをドロップ", small="またはタップして選ぶ（2つ以上・何個でもOK）", accept="application/pdf,.pdf", multi="multiple", opts="", run="結合する") + """
<h2>使い方</h2>
<ol>
<li>まとめたい PDF をドロップするか、枠をタップして選びます（あとから追加もできます）。</li>
<li>↑↓ ボタンで順番を並べ替えます。いらないファイルは ✕ で外します。</li>
<li>「結合する」を押して、できた PDF を保存します。</li>
</ol>
""",
     [("PDFはアップロードされますか？", "いいえ。結合はお使いのブラウザの中だけで行い、ファイルがサーバーに送られることはありません。"),
      ("パスワード付きのPDFは結合できますか？", "パスワードで保護された PDF は扱えません。先に保護を解除してください。"),
      ("ファイル数や容量の上限は？", "上限は決めていません。ただし数百MBを超えるような大きなファイルは、端末のメモリによっては時間がかかったり失敗したりします。"),
      ("スマホでも使えますか？", "使えます。iPhone では保存したPDFが「ファイル」アプリに入ります。")],
     pdf_script("merge"), card="複数のPDFを1つに。順番の並べ替えもOK", group="PDF")

page("pdf-split",
     "PDF分割・ページ抽出（無料・登録不要）｜かんたんツール箱",
     "PDF分割・ページ抽出",
     "PDFから必要なページだけを取り出したり、1ページずつ別のファイルに分けたりできます。ページ指定は「1-3, 5」のようにかんたん。ファイルはサーバーに送信されません。",
     """<span class="badge">無料・登録不要・アップロードなし</span>
<h1>PDF分割・ページ抽出</h1>
<p class="lead">必要なページだけを取り出したり、1ページずつ別の PDF に分けたりします。</p>
""" + PDF_DROP.format(aria="PDFを選ぶ", strong="ここにPDFをドロップ", small="またはタップして選ぶ（1ファイル）", accept="application/pdf,.pdf", multi="",
       opts="""<div id="splitOpts" class="options" hidden>
<label style="flex-direction:row;align-items:center;gap:8px"><input type="radio" name="how" value="range" checked> 指定したページを取り出す</label>
<label style="flex-direction:row;align-items:center;gap:8px"><input type="radio" name="how" value="each"> 1ページずつ分ける</label>
<label id="rangeRow">取り出すページ（例: 1-3, 5, 8-）<input id="ranges" type="text" inputmode="numeric" placeholder="1-3, 5"></label>
</div>""", run="作成する") + """
<h2>ページの指定のしかた</h2>
<ul>
<li><b>1-3</b>: 1〜3ページ</li>
<li><b>1-3, 5</b>: 1〜3ページと5ページ</li>
<li><b>8-</b>: 8ページから最後まで</li>
<li><b>3, 1, 2</b>: 書いた順番に並びます（順番の入れ替えにも使えます）</li>
</ul>
""",
     [("PDFはアップロードされますか？", "いいえ。処理はお使いのブラウザの中だけで行います。"),
      ("取り出したページの画質は落ちますか？", "落ちません。ページをそのままコピーしているので、文字の検索やリンクも元のまま残ります。"),
      ("特定のページを削除したいときは？", "残したいページだけを指定して取り出してください（例: 10ページ中4ページ目を消すなら「1-3, 5-」）。")],
     pdf_script("split"), card="必要なページだけ取り出す・1ページずつ分ける", group="PDF")

page("image-to-pdf",
     "画像をPDFに変換（JPG・PNG・HEIC→PDF）無料｜かんたんツール箱",
     "画像をPDFに変換",
     "写真やスクリーンショットを1つのPDFにまとめます。JPG・PNG・iPhoneのHEICに対応、A4サイズに合わせることもできます。画像はサーバーに送信されません。",
     """<span class="badge">無料・登録不要・アップロードなし</span>
<h1>画像をPDFに変換</h1>
<p class="lead">書類を撮った写真や、スクリーンショットを1つの PDF にまとめます。提出用の書類づくりに。</p>
""" + PDF_DROP.format(aria="画像を選ぶ", strong="ここに画像をドロップ", small="またはタップして選ぶ（複数OK）／ JPG・PNG・WebP・HEIC（iPhone）", accept="image/*,.heic,.heif", multi="multiple",
       opts="""<div class="options">
<label>ページの大きさ<select id="pageSize"><option value="auto" selected>A4（画像の向きに合わせる）</option><option value="a4p">A4 縦</option><option value="a4l">A4 横</option><option value="fit">画像と同じ大きさ</option></select></label>
<label>余白<select id="margin"><option value="0">なし</option><option value="20" selected>小（約7mm）</option><option value="40">大（約14mm）</option></select></label>
</div>""", run="PDFを作る") + """
<h2>使い方</h2>
<ol>
<li>画像をドロップするか、枠をタップして選びます。</li>
<li>↑↓ で並べ替え、ページの大きさと余白を選びます。</li>
<li>「PDFを作る」を押して保存します。1枚の画像が1ページになります。</li>
</ol>
""",
     [("画像はアップロードされますか？", "いいえ。PDF はお使いのブラウザの中だけで作ります。"),
      ("PDFの容量が大きくなりすぎませんか？", "大きな写真は長い辺が2400ピクセルになるように縮めてから入れるので、スマホの写真でも1枚あたり数百KB程度に収まります。"),
      ("iPhone の写真（HEIC）も使えますか？", "使えます。")],
     pdf_script("img2pdf", img=True), card="写真やスクショを1つのPDFに。A4にも合わせられる", group="PDF")

page("qr-code",
     "QRコード作成（無料・登録不要・ロゴなし・期限なし）｜かんたんツール箱",
     "QRコード作成",
     "URLや文章からQRコードを作ります。PNG・SVGで保存、色と大きさも変えられます。有効期限やロゴの透かしはなく、ずっと使えます。入力内容はサーバーに送信されません。",
     """<span class="badge">無料・登録不要・期限なし</span>
<h1>QRコード作成</h1>
<p class="lead">URL・文章・Wi-Fi の案内などを QR コードにします。作ったコードに有効期限はなく、印刷物にもそのまま使えます。</p>
<div class="card">
<label for="text" style="color:var(--muted)">QR コードにする文字（URL など）</label>
<textarea id="text" style="min-height:90px" placeholder="https://example.com"></textarea>
<div class="options">
<label>誤り訂正<select id="ec"><option value="L">L（文字を多く入れられる）</option><option value="M" selected>M（標準）</option><option value="Q">Q</option><option value="H">H（汚れや欠けに強い）</option></select></label>
<label>PNG の大きさ<select id="size"><option value="256">256px</option><option value="512" selected>512px</option><option value="1024">1024px（印刷向け）</option><option value="2048">2048px</option></select></label>
<label>色<input id="fg" type="color" value="#000000"></label>
<label>背景<input id="bg" type="color" value="#ffffff"></label>
</div>
<div id="view" class="qr-view"></div>
<p id="info" style="text-align:center;color:var(--muted);font-size:13px;margin:6px 0 0"></p>
<div class="row" style="justify-content:center;margin-top:10px"><button id="png" disabled>PNG で保存</button><button id="svg" class="ghost" disabled>SVG で保存</button></div>
</div>
<div class="ad-slot" data-ad="tool"></div>
<h2>きれいに読み取ってもらうコツ</h2>
<ul>
<li>色を変えるときは、<b>濃い色のコード × 明るい背景</b>にします。逆にすると読めないアプリがあります。</li>
<li>印刷するときは 2cm 角以上を目安にし、まわりに白い余白を残します。</li>
<li>チラシなど汚れやすい場所には、誤り訂正を「H」にしておくと安心です。</li>
</ul>
""",
     [("作ったQRコードに期限はありますか？", "ありません。このツールは文字をそのまま QR コードにするので、どこかのサーバーを経由せず、ずっと読み取れます。"),
      ("商用利用できますか？", "できます。チラシ・名刺・商品パッケージなどに自由にお使いください。"),
      ("入力したURLは送信されますか？", "いいえ。QR コードはお使いのブラウザの中だけで作ります。"),
      ("「QRコード」は登録商標ですか？", "QRコードは株式会社デンソーウェーブの登録商標です。")],
     '<script src="../vendor/qrcode.js"></script>\n<script src="qr.js"></script>', card="URLや文章をQRコードに。PNG・SVG保存、期限なし", group="その他")


# ───────── 一覧・運営者情報・sitemap ─────────
def root_page(fname, title, desc, body):
    canonical = f'<link rel="canonical" href="{SITE}{"" if fname == "index.html" else fname}">\n' if SITE else ""
    head = HEAD.format(title=title, desc=desc, ld="[]", canonical=canonical).replace("../", "./")
    head = head.replace('<script type="application/ld+json">[]</script>\n', "")
    open(f"{ROOT}/{fname}", "w").write(head + body + FOOT.format(scripts="").replace("../", "./"))

groups = {}
for slug, h1, card, grp in PAGES:
    groups.setdefault(grp, []).append(f'<li><a href="./{slug}/"><div class="card"><h3>{h1}</h3><p>{card}</p></div></a></li>')
index_body = """<h1>かんたんツール箱</h1>
<p class="lead">登録不要・無料。文章や画像、PDF はお使いのブラウザの中だけで処理するので、外に送られる心配がありません。</p>
""" + "".join(f'<h2>{g}</h2>\n<ul class="tool-list">\n' + "\n".join(groups[g]) + "\n</ul>\n" for g in ["文章", "画像", "PDF", "その他"] if g in groups) + '<div class="ad-slot" data-ad="index"></div>\n'
root_page("index.html", "かんたんツール箱｜登録不要・アップロードなしの無料ツール",
          "文字数カウント、画像圧縮、HEIC→JPG変換、PDF結合、QRコード作成など、ブラウザだけで使える無料ツール集。ファイルや文章はサーバーに送信されません。", index_body)

about_body = """<h1>運営者情報・プライバシーポリシー</h1>

<h2>このサイトについて</h2>
<p>「かんたんツール箱」は、文章・画像・PDF のちょっとした作業をブラウザだけで済ませられる無料ツール集です。個人が運営しています。</p>

<h2>入力した文章・ファイルの取り扱い</h2>
<p>各ツールに入力した文章や、選んだ画像・PDF は、お使いの端末のブラウザの中だけで処理します。運営者のサーバーや第三者に送信・保存することはありません。処理に使うプログラムはすべてこのサイトに置いてあり、外部から読み込むことはありません。</p>
<p>文字数カウントでは、入力中の文章をお使いのブラウザ（localStorage）にだけ保存し、次に開いたときに続きから使えるようにしています。ブラウザのサイトデータを消すと削除されます。</p>

<h2>広告について</h2>
<p>当サイトでは、第三者配信の広告サービス（Google AdSense）を利用することがあります。広告配信事業者は、利用者の興味に応じた広告を表示するために Cookie を使用することがあります。Cookie を無効にする方法や Google AdSense の詳細は、<a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener">Google の広告に関するポリシー</a>をご覧ください。パーソナライズ広告は <a href="https://adssettings.google.com/" rel="noopener">広告設定</a> で無効にできます。</p>

<h2>アクセス解析について</h2>
<p>サイトの改善のために、アクセス解析ツールを利用することがあります。解析ツールは Cookie を使って匿名のアクセス情報を集めます。個人を特定する情報は含みません。</p>

<h2>免責事項</h2>
<p>各ツールの結果はできるかぎり正確になるよう作っていますが、正確さを保証するものではありません。当サイトの利用によって生じた損害について、運営者は責任を負いかねます。大切なファイルは元のファイルを残したうえでお使いください。</p>

<h2>使用しているライブラリ</h2>
<p>pdf-lib、heic2any、qrcode-generator（いずれも MIT License）を使用しています。<a href="./vendor/LICENSES.txt">ライセンス全文</a></p>

<h2>お問い合わせ</h2>
<p>不具合のご報告やご要望は、<a href="https://github.com/mmmtgn08/pachislo/issues" rel="noopener">GitHub の Issues</a> からお送りください。</p>

<p><small>制定日: 2026年11月21日</small></p>
"""
root_page("about.html", "運営者情報・プライバシーポリシー｜かんたんツール箱", "かんたんツール箱の運営者情報、プライバシーポリシー、免責事項。", about_body)

if SITE:
    urls = [SITE] + [f"{SITE}{slug}/" for slug, *_ in PAGES] + [f"{SITE}about.html"]
    Path(ROOT, "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls) + "\n</urlset>\n")
    Path(ROOT, "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /_build/\n\nSitemap: {SITE}sitemap.xml\n")
print(f"{len(PAGES)} ツール + 一覧 + 運営者情報" + (f"（{SITE}）" if SITE else "（CNAME なし: canonical・sitemap は省略）"))
