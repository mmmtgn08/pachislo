// PDF ツール共通。ファイルはブラウザの中だけで処理し、どこにも送らない。
// ページ側で window.PDF_TOOL = {mode: 'merge' | 'split' | 'img2pdf'} を先に書く。
(() => {
  const {PDFDocument} = window.PDFLib;
  const mode = (window.PDF_TOOL || {}).mode;
  const $ = (s) => document.querySelector(s);
  const drop = $('#drop');
  const input = $('#file');
  const list = $('#files');
  const runBtn = $('#run');
  const out = $('#out');
  const items = []; // {file, pages?, thumb?}

  const fmtSize = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(2)}MB`);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const base = (n) => n.replace(/\.[^.]+$/, '');
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isImg = (f) => f.type.startsWith('image/') || window.ImgCore?.isHeic(f);

  function setOut(html) {
    out.innerHTML = html;
  }
  function download(bytes, name, label = '保存') {
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    return `<a class="btn" href="${url}" download="${esc(name)}">${esc(label)}</a>`;
  }
  async function loadPdf(file) {
    try {
      return await PDFDocument.load(await file.arrayBuffer(), {ignoreEncryption: false});
    } catch (e) {
      if (/encrypt/i.test(String(e))) throw new Error('パスワードで保護されたPDFは扱えません');
      throw new Error('PDFとして読み込めませんでした');
    }
  }

  // ── 一覧(並べ替えできる) ──
  function render() {
    list.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      const sub = it.error ? `<span class="warn">${esc(it.error)}</span>` : `${fmtSize(it.file.size)}${it.pages ? ` ・ ${it.pages}ページ` : ''}`;
      li.innerHTML = `${it.thumb ? `<img alt="" src="${it.thumb}">` : '<div class="pdf-icon">PDF</div>'}
        <div><div class="name">${i + 1}. ${esc(it.file.name)}</div><div class="meta">${sub}</div></div>
        <div class="row" style="gap:6px">
          ${items.length > 1 && mode !== 'split' ? `<button class="ghost sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="上へ">↑</button><button class="ghost sm" data-down="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="下へ">↓</button>` : ''}
          <button class="ghost sm" data-del="${i}" aria-label="削除">✕</button>
        </div>`;
      list.appendChild(li);
    });
    const ok = items.filter((it) => !it.error).length;
    if (runBtn) runBtn.disabled = mode === 'merge' ? ok < 2 : ok < 1;
    const sp = $('#splitOpts');
    if (sp) sp.hidden = ok < 1;
    setOut('');
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = +(b.dataset.up ?? b.dataset.down ?? b.dataset.del);
    if (b.dataset.up) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    else if (b.dataset.down) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    else items.splice(i, 1);
    render();
  });

  async function addFiles(files) {
    for (const f of files) {
      if (mode === 'img2pdf') {
        if (!isImg(f)) continue;
        const it = {file: f};
        items.push(it);
        try {
          const bmp = await window.ImgCore.decodeImage(f);
          const c = document.createElement('canvas');
          const s = 112 / Math.max(bmp.width, bmp.height);
          c.width = Math.max(1, Math.round(bmp.width * s));
          c.height = Math.max(1, Math.round(bmp.height * s));
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          it.thumb = c.toDataURL('image/jpeg', 0.7);
        } catch (e) {
          it.error = e.message;
        }
      } else {
        if (!isPdf(f)) continue;
        if (mode === 'split') items.length = 0; // 分割は1ファイルだけ
        const it = {file: f};
        items.push(it);
        try {
          it.doc = await loadPdf(f);
          it.pages = it.doc.getPageCount();
        } catch (e) {
          it.error = e.message;
        }
      }
      render();
      if (mode === 'split') break;
    }
  }

  // ── 結合 ──
  async function merge() {
    const outDoc = await PDFDocument.create();
    for (const it of items) {
      if (it.error) continue;
      const pages = await outDoc.copyPages(it.doc, it.doc.getPageIndices());
      pages.forEach((p) => outDoc.addPage(p));
    }
    const bytes = await outDoc.save();
    setOut(`<p>${outDoc.getPageCount()}ページ・${fmtSize(bytes.length)} のPDFができました。</p>${download(bytes, 'merged.pdf', '結合したPDFを保存')}`);
  }

  // ── 分割・抽出 ──
  function parseRanges(text, max) {
    const pages = [];
    for (const part of text.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[ー－〜~]/g, '-').split(/[,、，\s]+/)) {
      if (!part) continue;
      const m = part.match(/^(\d+)(?:-(\d*))?$/);
      if (!m) throw new Error(`「${part}」の書き方がわかりません（例: 1-3, 5）`);
      const a = +m[1];
      const b = m[2] === undefined ? a : m[2] === '' ? max : +m[2];
      if (a < 1 || b > max || a > b) throw new Error(`「${part}」は 1〜${max} の範囲で指定してください`);
      for (let p = a; p <= b; p++) pages.push(p - 1);
    }
    if (!pages.length) throw new Error('ページを指定してください（例: 1-3, 5）');
    return pages;
  }
  async function split() {
    const it = items.find((x) => !x.error);
    const max = it.pages;
    const how = document.querySelector('input[name="how"]:checked').value;
    const name = base(it.file.name);
    if (how === 'each') {
      const links = [];
      for (let p = 0; p < max; p++) {
        const d = await PDFDocument.create();
        const [pg] = await d.copyPages(it.doc, [p]);
        d.addPage(pg);
        links.push(download(await d.save(), `${name}_${p + 1}.pdf`, `${p + 1}ページ`));
      }
      setOut(`<p>${max}個のPDFに分けました。</p><div class="row" style="gap:6px">${links.join('')}</div>`);
      return;
    }
    const pages = parseRanges($('#ranges').value, max);
    const d = await PDFDocument.create();
    (await d.copyPages(it.doc, pages)).forEach((p) => d.addPage(p));
    const bytes = await d.save();
    setOut(`<p>${pages.length}ページを取り出しました（${fmtSize(bytes.length)}）。</p>${download(bytes, `${name}_pages.pdf`, '取り出したPDFを保存')}`);
  }

  // ── 画像 → PDF ──
  const A4 = [595.28, 841.89];
  async function img2pdf() {
    const size = $('#pageSize').value;
    const margin = +$('#margin').value;
    const d = await PDFDocument.create();
    for (const it of items) {
      if (it.error) continue;
      const bmp = await window.ImgCore.decodeImage(it.file);
      // 大きすぎる写真は長辺 2400px に抑える(容量対策)
      const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s);
      c.height = Math.round(bmp.height * s);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const jpg = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
      const img = await d.embedJpg(await jpg.arrayBuffer());
      let pw, ph;
      if (size === 'fit') {
        pw = img.width * 0.75 + margin * 2; // 96dpi 相当
        ph = img.height * 0.75 + margin * 2;
      } else {
        const land = size === 'a4l' || (size === 'auto' && img.width > img.height);
        [pw, ph] = land ? [A4[1], A4[0]] : A4;
      }
      const page = d.addPage([pw, ph]);
      const k = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
      const w = img.width * k, h = img.height * k;
      page.drawImage(img, {x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h});
    }
    const bytes = await d.save();
    setOut(`<p>${d.getPageCount()}ページ・${fmtSize(bytes.length)} のPDFができました。</p>${download(bytes, 'images.pdf', 'PDFを保存')}`);
  }

  runBtn?.addEventListener('click', async () => {
    runBtn.disabled = true;
    setOut('<p>作成中…</p>');
    try {
      await (mode === 'merge' ? merge() : mode === 'split' ? split() : img2pdf());
    } catch (e) {
      setOut(`<p class="warn">${esc(e.message || '作成できませんでした')}</p>`);
    }
    runBtn.disabled = false;
  });

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()));
  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => (e.preventDefault(), drop.classList.add('on'))));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => (e.preventDefault(), drop.classList.remove('on'))));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  document.querySelectorAll('input[name="how"]').forEach((r) =>
    r.addEventListener('change', () => ($('#rangeRow').hidden = document.querySelector('input[name="how"]:checked').value !== 'range')),
  );
  render();
})();
