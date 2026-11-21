// 文字数カウント。文章はブラウザの中だけで数え、どこにも送らない。
(() => {
  const $ = (id) => document.getElementById(id);
  const ta = $('text');
  const goal = $('goal');
  const KEY = 'moji-count-draft';
  const seg = 'Segmenter' in Intl ? new Intl.Segmenter('ja', {granularity: 'grapheme'}) : null;
  const chars = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : Array.from(s));
  const n = (v) => v.toLocaleString('ja-JP');

  // X(Twitter) の数え方: この範囲の文字は1、それ以外は2。URL は 23。
  const xWeight = (cp) =>
    (cp <= 4351) || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247) ? 1 : 2;
  function xCount(s) {
    let total = 0;
    const rest = s.replace(/https?:\/\/[^\s　]+/g, () => ((total += 23), ''));
    for (const g of chars(rest)) total += xWeight(g.codePointAt(0));
    return total;
  }
  // Shift_JIS のバイト数(目安): 半角英数・半角カナは1、それ以外は2、改行は2
  function sjisBytes(s) {
    let b = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (ch === '\n') b += 2;
      else if (c < 0x80 || (c >= 0xff61 && c <= 0xff9f)) b += 1;
      else b += 2;
    }
    return b;
  }
  const isHan = (c) => c < 0x80 || (c >= 0xff61 && c <= 0xff9f);

  function update() {
    const s = ta.value.replace(/\r\n?/g, '\n');
    const g = chars(s);
    const noBreak = g.filter((c) => c !== '\n');
    const noSpace = g.filter((c) => !/^[\s　]+$/.test(c));
    $('all').textContent = n(g.length);
    $('noSpace').textContent = n(noSpace.length);
    $('noBreak').textContent = n(noBreak.length);
    const lines = s ? s.split('\n') : [];
    $('lines').textContent = n(lines.length);
    $('paras').textContent = n(lines.filter((l) => l.trim()).length);
    // 原稿用紙: 段落ごとに 20 字で折り返した行数 → 20 行で 1 枚
    const genkoLines = lines.reduce((sum, l) => sum + Math.max(1, Math.ceil(chars(l).length / 20)), 0);
    $('genko').textContent = s ? Math.ceil(genkoLines / 20) : 0;
    $('genkoLines').textContent = s ? `（${genkoLines}行）` : '';
    const sec = Math.round((noSpace.length / 500) * 60);
    $('read').textContent = sec < 60 ? `${sec}秒` : `${Math.floor(sec / 60)}分${sec % 60 ? (sec % 60) + '秒' : ''}`;
    const x = 280 - xCount(s);
    $('x').textContent = n(x);
    $('x').style.color = x < 0 ? 'var(--warn)' : '';
    let han = 0;
    for (const c of noBreak) if (isHan(c.codePointAt(0)) && c.length === 1) han++;
    $('han').textContent = n(han);
    $('zen').textContent = n(noBreak.length - han);
    $('utf8').textContent = n(new TextEncoder().encode(s).length);
    $('sjis').textContent = n(sjisBytes(s));

    const target = parseInt(goal.value, 10);
    const bar = $('goalBar');
    if (target > 0) {
      const cur = noSpace.length;
      const pct = Math.min(100, (cur / target) * 100);
      bar.hidden = false;
      bar.classList.toggle('over', cur > target);
      bar.firstElementChild.style.width = pct + '%';
      $('goalText').textContent = cur > target ? `${n(cur - target)}字オーバー（空白除く）` : `あと${n(target - cur)}字（空白除く・${pct.toFixed(0)}%）`;
    } else {
      bar.hidden = true;
      $('goalText').textContent = '';
    }
  }

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  ta.value = store.get(KEY) || '';
  goal.value = store.get(KEY + '-goal') || '';
  let timer;
  ta.addEventListener('input', () => {
    update();
    clearTimeout(timer);
    timer = setTimeout(() => store.set(KEY, ta.value), 400);
  });
  goal.addEventListener('input', () => (update(), store.set(KEY + '-goal', goal.value)));
  $('clear').addEventListener('click', () => {
    if (ta.value && !confirm('入力した文章を消しますか？')) return;
    ta.value = '';
    store.set(KEY, '');
    update();
    ta.focus();
  });
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ta.value);
      $('copy').textContent = 'コピーしました';
    } catch {
      ta.select();
      document.execCommand('copy');
      $('copy').textContent = 'コピーしました';
    }
    setTimeout(() => ($('copy').textContent = '文章をコピー'), 1500);
  });
  update();
})();
