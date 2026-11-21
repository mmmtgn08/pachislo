// 画像の読み込み(共通)。iPhone の HEIC は、ブラウザが読めないときだけ同梱の変換ライブラリを読み込む。
(() => {
  const here = document.currentScript.src.replace(/[^/]*$/, '');
  const isHeic = (f) => /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
  let lib;
  const loadHeic = () =>
    (lib ||= new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = here + 'vendor/heic2any.min.js';
      s.onload = () => ok(window.heic2any);
      s.onerror = () => ng(new Error('HEIC を読み込む準備に失敗しました'));
      document.head.appendChild(s);
    }));
  async function decodeImage(file) {
    try {
      return await createImageBitmap(file);
    } catch (e) {
      if (!isHeic(file)) throw new Error('この画像は読み込めませんでした');
      const heic2any = await loadHeic();
      const out = await heic2any({blob: file, toType: 'image/png'});
      return await createImageBitmap(Array.isArray(out) ? out[0] : out);
    }
  }
  window.ImgCore = {decodeImage, isHeic};
})();
