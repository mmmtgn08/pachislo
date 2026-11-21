// QR コード作成。入力はブラウザの中だけで処理し、どこにも送らない。
(() => {
  const $ = (id) => document.getElementById(id);
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const text = $('text');
  const view = $('view');
  const info = $('info');
  let svgText = '';
  let modules = null;

  function make() {
    const v = text.value;
    const ec = $('ec').value;
    if (!v) {
      view.innerHTML = '<p class="placeholder">ここに QR コードが出ます</p>';
      info.textContent = '';
      $('png').disabled = $('svg').disabled = true;
      modules = null;
      return;
    }
    let qr;
    try {
      qr = qrcode(0, ec);
      qr.addData(v, 'Byte');
      qr.make();
    } catch (e) {
      view.innerHTML = '<p class="placeholder warn">文字が多すぎて QR コードにできません。短くするか、誤り訂正を「L」にしてください。</p>';
      info.textContent = '';
      $('png').disabled = $('svg').disabled = true;
      modules = null;
      return;
    }
    const n = qr.getModuleCount();
    modules = {n, dark: (r, c) => qr.isDark(r, c)};
    const fg = $('fg').value, bg = $('bg').value, q = 4, size = n + q * 2;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + q} ${r + q}h1v1h-1z`;
    svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
    view.innerHTML = svgText;
    info.textContent = `${new TextEncoder().encode(v).length}バイト ・ ${n}×${n}マス`;
    $('png').disabled = $('svg').disabled = false;
  }

  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  $('png').addEventListener('click', () => {
    if (!modules) return;
    const px = +$('size').value, q = 4, cells = modules.n + q * 2, cell = px / cells;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    ctx.fillStyle = $('bg').value;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = $('fg').value;
    for (let r = 0; r < modules.n; r++)
      for (let k = 0; k < modules.n; k++)
        if (modules.dark(r, k)) ctx.fillRect(Math.floor((k + q) * cell), Math.floor((r + q) * cell), Math.ceil(cell), Math.ceil(cell));
    c.toBlob((b) => save(b, 'qrcode.png'), 'image/png');
  });
  $('svg').addEventListener('click', () => svgText && save(new Blob([svgText], {type: 'image/svg+xml'}), 'qrcode.svg'));
  ['text', 'ec', 'fg', 'bg'].forEach((id) => $(id).addEventListener('input', make));
  make();
})();
