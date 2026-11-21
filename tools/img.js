// 画像ツール共通エンジン。ファイルはブラウザの中だけで処理し、どこにも送らない。
// ページ側で <script>window.IMG_TOOL = {mode: 'compress' | 'convert' | 'exif'}</script> を先に書く。
(() => {
  const cfg = window.IMG_TOOL || {mode: 'compress'};
  const $ = (s) => document.querySelector(s);
  const drop = $('#drop');
  const input = $('#file');
  const list = $('#files');
  const saveAll = $('#saveAll');
  const results = [];

  const fmtSize = (n) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1024 / 1024).toFixed(2)}MB`);
  const isHeic = (f) => /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
  const extOf = (type) => ({'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'})[type] || 'jpg';
  const baseName = (name) => name.replace(/\.[^.]+$/, '');

  // ── オプション ──
  const opt = (id, def) => {
    const el = document.getElementById(id);
    if (!el) return def;
    return el.type === 'checkbox' ? el.checked : el.value;
  };
  const qLabel = $('#qualityLabel');
  const q = $('#quality');
  if (q && qLabel) {
    const upd = () => (qLabel.textContent = q.value);
    q.addEventListener('input', upd);
    upd();
  }

  // ── HEIC 読み込み（Safari 以外はライブラリを必要なときだけ読む）──
  let heicLib;
  const loadHeicLib = () =>
    (heicLib ||= new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload = () => ok(window.heic2any);
      s.onerror = () => ng(new Error('HEIC 変換ライブラリを読み込めませんでした'));
      document.head.appendChild(s);
    }));

  async function decode(file) {
    try {
      return await createImageBitmap(file);
    } catch (e) {
      if (!isHeic(file)) throw new Error('この画像は読み込めませんでした');
      const heic2any = await loadHeicLib();
      const out = await heic2any({blob: file, toType: 'image/png'});
      return await createImageBitmap(Array.isArray(out) ? out[0] : out);
    }
  }

  // ── JPEG の EXIF から、残っている情報を調べる ──
  async function readExif(file) {
    if (!/jpe?g$/i.test(file.type.split('/')[1] || '') && !/\.jpe?g$/i.test(file.name)) return null;
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null;
    let p = 2;
    while (p + 4 < buf.byteLength) {
      const marker = buf.getUint16(p);
      const len = buf.getUint16(p + 2);
      if (marker === 0xffe1 && buf.getUint32(p + 4) === 0x45786966) return parseTiff(buf, p + 10);
      if ((marker & 0xff00) !== 0xff00) break;
      p += 2 + len;
    }
    return null;
  }
  function parseTiff(v, t) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = (o) => v.getUint16(t + o, le);
    const u32 = (o) => v.getUint32(t + o, le);
    const ifd = (o) => {
      const tags = {};
      if (t + o + 2 > v.byteLength) return tags;
      const n = u16(o);
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12;
        if (t + e + 12 > v.byteLength) break;
        tags[u16(e)] = {type: u16(e + 2), count: u32(e + 4), off: e + 8};
      }
      return tags;
    };
    const str = (tag) => {
      if (!tag) return '';
      const at = tag.count > 4 ? u32(tag.off) : tag.off;
      let s = '';
      for (let i = 0; i < tag.count - 1 && t + at + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(t + at + i));
      return s.trim();
    };
    const rat3 = (tag) => {
      if (!tag) return null;
      const at = u32(tag.off);
      const r = (i) => u32(at + i * 8) / (u32(at + i * 8 + 4) || 1);
      return r(0) + r(1) / 60 + r(2) / 3600;
    };
    const info = {};
    const ifd0 = ifd(u32(4));
    const model = [str(ifd0[0x010f]), str(ifd0[0x0110])].filter(Boolean).join(' ');
    if (model) info.camera = model;
    if (ifd0[0x8769]) {
      const ex = ifd(u32(ifd0[0x8769].off));
      const dt = str(ex[0x9003]);
      if (dt) info.date = dt.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1/$2/$3');
    }
    if (ifd0[0x8825]) {
      const g = ifd(u32(ifd0[0x8825].off));
      const lat = rat3(g[2]);
      const lon = rat3(g[4]);
      if (lat != null && lon != null && (lat || lon)) {
        const ns = String.fromCharCode(v.getUint8(t + g[1].off)) === 'S' ? -1 : 1;
        const ew = String.fromCharCode(v.getUint8(t + g[3].off)) === 'W' ? -1 : 1;
        info.gps = [(lat * ns).toFixed(5), (lon * ew).toFixed(5)];
      }
    }
    return info;
  }

  // ── 変換 ──
  function outType(file) {
    const want = opt('format', 'keep');
    if (want !== 'keep') return want;
    if (/image\/(png|webp|jpeg)/.test(file.type)) return file.type;
    return file.type === 'image/gif' || file.type === 'image/bmp' ? 'image/png' : 'image/jpeg';
  }

  async function encode(file) {
    const bmp = await decode(file);
    const maxW = parseInt(opt('maxW', '0'), 10) || 0;
    const origW = bmp.width;
    let w = bmp.width;
    let h = bmp.height;
    if (maxW && w > maxW) {
      h = Math.round((h * maxW) / w);
      w = maxW;
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const type = outType(file);
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const quality = parseInt(opt('quality', '85'), 10) / 100;
    const blob = await new Promise((ok) => c.toBlob(ok, type, quality));
    if (!blob) throw new Error('この形式では保存できませんでした');
    return {blob, type: blob.type, w, h, resized: w !== origW};
  }

  function row(file) {
    const li = document.createElement('li');
    li.innerHTML = `<img alt=""><div><div class="name"></div><div class="meta">処理中…</div></div><div class="act"></div>`;
    li.querySelector('.name').textContent = file.name;
    list.appendChild(li);
    return li;
  }

  async function handle(file) {
    const li = row(file);
    const meta = li.querySelector('.meta');
    try {
      const exif = cfg.mode === 'exif' ? await readExif(file) : null;
      let {blob, type, w, h, resized} = await encode(file);
      let note = '';
      // 圧縮で元より大きくなったら、元のファイルを使う
      if (cfg.mode === 'compress' && blob.size >= file.size && type === file.type && !resized) {
        blob = file;
        note = '<span class="warn">これ以上小さくできないため元のまま</span>';
      }
      const url = URL.createObjectURL(blob);
      const name = `${baseName(file.name)}${cfg.mode === 'convert' ? '' : cfg.mode === 'exif' ? '_clean' : '_min'}.${extOf(blob.type || type)}`;
      li.querySelector('img').src = url;
      const diff = Math.round((1 - blob.size / file.size) * 100);
      let text = `${fmtSize(file.size)} → <b>${fmtSize(blob.size)}</b>`;
      if (diff > 0) text += ` <span class="good">${diff}%減</span>`;
      text += ` ・ ${w}×${h}`;
      if (cfg.mode === 'exif') {
        if (exif && (exif.gps || exif.camera || exif.date)) {
          const found = [];
          if (exif.gps) found.push(`位置情報（${exif.gps.join(', ')}）`);
          if (exif.camera) found.push(`機種（${exif.camera}）`);
          if (exif.date) found.push(`撮影日時（${exif.date}）`);
          text += `<br><span class="warn">元の写真に残っていた情報:</span> ${found.map(escape).join('、')} → <span class="good">すべて削除しました</span>`;
        } else {
          text += `<br><span class="good">位置情報などの写真の情報を含まない画像として保存しました</span>`;
        }
      }
      if (note) text += `<br>${note}`;
      meta.innerHTML = text;
      const a = document.createElement('a');
      a.className = 'btn';
      a.href = url;
      a.download = name;
      a.textContent = '保存';
      li.querySelector('.act').appendChild(a);
      results.push(a);
      if (saveAll) saveAll.hidden = results.length < 2;
    } catch (e) {
      meta.innerHTML = `<span class="warn">${escape(e.message || '処理できませんでした')}</span>`;
    }
  }
  function escape(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  }

  const sources = [];
  let busy = Promise.resolve();
  function addFiles(files) {
    const imgs = files.filter((f) => f.type.startsWith('image/') || isHeic(f));
    sources.push(...imgs);
    busy = busy.then(async () => {
      for (const f of imgs) await handle(f);
    });
  }
  // 設定を変えたら、入れた画像をすべて処理し直す
  document.querySelectorAll('.options select, .options input').forEach((el) =>
    el.addEventListener('change', () => {
      busy = busy.then(async () => {
        results.forEach((a) => URL.revokeObjectURL(a.href));
        results.length = 0;
        list.innerHTML = '';
        if (saveAll) saveAll.hidden = true;
        for (const f of sources) await handle(f);
      });
    }),
  );

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()));
  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => (e.preventDefault(), drop.classList.add('on'))));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => (e.preventDefault(), drop.classList.remove('on'))));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  document.addEventListener('paste', (e) => {
    const fs = [...(e.clipboardData?.files || [])];
    if (fs.length) addFiles(fs);
  });
  saveAll?.addEventListener('click', async () => {
    for (const a of results) {
      a.click();
      await new Promise((r) => setTimeout(r, 300));
    }
  });
})();
