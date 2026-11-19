// 台本JSON → VOICEVOX ナレーション → 実写素材(Pexels / Pixabay) → Remotion で mp4
//   node scripts/render.mjs topics/tako.json --out out/video.mp4 [--tts dummy] [--clips dummy]
//
// 環境変数: PEXELS_API_KEY（必須。--clips dummy なら不要） / PIXABAY_API_KEY（任意。Pexels で見つからないときの予備）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = path.join(ROOT, '..', 'moshimo', 'tools'); // 効果音・BGM の合成は もしも と共通
const FPS = 30;
const W = 1080, H = 1920;
const SPEAKER = Number(process.env.VOICE_SPEAKER || 8); // 8 = 春日部つむぎ(ノーマル)
const SPEAKER_CREDIT = process.env.VOICE_CREDIT || 'VOICEVOX:春日部つむぎ';
const SPEED = Number(process.env.VOICE_SPEED || 1.2);
const VOICEVOX = (process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').replace(/\/$/, '');
const SE_NAMES = ['pop', 'don', 'peka', 'chan', 'boo', 'whoosh', 'kira'];
const FORMATS = ['ranking', 'list', 'quiz', 'myth', 'single'];

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const scriptPath = args[0];
const out = path.resolve(opt('--out', 'out/video.mp4'));
const tts = opt('--tts', 'voicevox');
const clipsMode = opt('--clips', 'stock');

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));

// ── 検証 ──
const errors = [];
if (!script.title) errors.push('title がありません');
if (script.format && !FORMATS.includes(script.format)) errors.push(`format は ${FORMATS.join('/')} のいずれか`);
if (!Array.isArray(script.scenes) || script.scenes.length < 4 || script.scenes.length > 10) errors.push('scenes は4〜10個');
for (const [i, s] of (script.scenes || []).entries()) {
  if (!s.text || s.text.length > 90) errors.push(`${i + 1}番目: text は1〜90文字`);
  if (!s.query || /[^\x20-\x7e]/.test(s.query)) errors.push(`${i + 1}番目: query は英語の検索語(必須)`);
  if (s.alt && (!Array.isArray(s.alt) || s.alt.some((q) => /[^\x20-\x7e]/.test(q)))) errors.push(`${i + 1}番目: alt は英語の検索語の配列`);
  if (s.se && !SE_NAMES.includes(s.se)) errors.push(`${i + 1}番目: se は ${SE_NAMES.join('/')} のいずれか`);
  if (s.telop && s.telop.split('\n').length > 3) errors.push(`${i + 1}番目: telop は3行まで`);
}
if (clipsMode === 'stock' && !process.env.PEXELS_API_KEY && !process.env.PIXABAY_API_KEY) errors.push('PEXELS_API_KEY が未設定です');
if (errors.length) {
  console.error('台本エラー:\n' + errors.join('\n'));
  process.exit(1);
}

// ── 効果音 ──
const sfxDir = path.join(ROOT, 'public', 'sfx');
if (!fs.existsSync(path.join(sfxDir, 'don.wav'))) {
  execFileSync('python3', [path.join(SHARED, 'sfx.py'), sfxDir], {stdio: 'inherit'});
}

// ── ナレーション ──
const wavSeconds = (buf) => {
  let p = 12, rate = 24000, ch = 1, bits = 16;
  while (p < buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      ch = buf.readUInt16LE(p + 10);
      rate = buf.readUInt32LE(p + 12);
      bits = buf.readUInt16LE(p + 22);
    }
    if (id === 'data') return size / (rate * ch * (bits / 8));
    p += 8 + size;
  }
  throw new Error('wav の解析に失敗');
};

const waitEngine = async () => {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${VOICEVOX}/version`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('VOICEVOX に接続できません');
};

const voiceDir = path.join(ROOT, 'public', 'voice');
fs.rmSync(voiceDir, {recursive: true, force: true});
fs.mkdirSync(voiceDir, {recursive: true});
if (tts === 'voicevox') await waitEngine();

const scenes = [];
for (const [i, s] of script.scenes.entries()) {
  let seconds, audio = null;
  if (tts === 'voicevox') {
    const q = await (await fetch(`${VOICEVOX}/audio_query?text=${encodeURIComponent(s.text)}&speaker=${SPEAKER}`, {method: 'POST'})).json();
    Object.assign(q, {speedScale: SPEED, intonationScale: 1.15, prePhonemeLength: 0.05, postPhonemeLength: 0.1});
    const r = await fetch(`${VOICEVOX}/synthesis?speaker=${SPEAKER}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(q)});
    if (!r.ok) throw new Error(`合成失敗: ${await r.text()}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(voiceDir, `s${i}.wav`), buf);
    seconds = wavSeconds(buf);
    audio = `voice/s${i}.wav`;
  } else {
    seconds = 0.6 + s.text.length * 0.11;
  }
  const frames = Math.max(45, Math.ceil((seconds + 0.3) * FPS));
  scenes.push({text: s.text, telop: s.telop || '', step: typeof s.step === 'number' ? s.step : null, se: s.se || null, audio, frames, clip: null});
}
const totalSec = scenes.reduce((a, s) => a + s.frames, 0) / FPS;
console.log(`長さ: ${totalSec.toFixed(1)}秒`);
if (totalSec > 59.5) {
  console.error('60秒を超えています。台本を短くしてください');
  process.exit(1);
}

// ── 実写素材 ──
const clipDir = path.join(ROOT, 'public', 'clips');
const cacheDir = path.join(ROOT, 'out', 'cache');
fs.rmSync(clipDir, {recursive: true, force: true});
fs.mkdirSync(clipDir, {recursive: true});
fs.mkdirSync(cacheDir, {recursive: true});

const getJson = async (url, headers = {}) => {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch(url, {headers});
      if (r.ok) return await r.json();
      console.warn(`検索失敗 ${r.status}: ${url.replace(/key=[^&]+/, 'key=***')}`);
      if (r.status < 500 && r.status !== 429) return null;
    } catch (e) {
      console.warn(`検索エラー: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * (k + 1)));
  }
  return null;
};

// 候補 {id, url, w, h, dur, credit}
const searchPexels = async (query) => {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const j = await getJson(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=30&size=medium`, {Authorization: key});
  return (j?.videos || []).map((v) => {
    // 縦長のファイルを優先し、1080〜2160 の高さを選ぶ(重すぎる 4K は避ける)
    const files = (v.video_files || []).filter((f) => f.file_type === 'video/mp4' && f.width && f.height);
    files.sort((a, b) => score(b) - score(a));
    const f = files[0];
    return f && {id: `pexels-${v.id}`, url: f.link, w: f.width, h: f.height, dur: v.duration, credit: `${v.user?.name || 'Pexels'} (Pexels)`};
  }).filter(Boolean);
};
const score = (f) => {
  const tall = Math.max(f.width, f.height) / Math.min(f.width, f.height);
  const portrait = f.height > f.width ? 2 : 0;
  const size = Math.min(f.height, f.width);
  const sizeScore = size >= 1080 && size <= 2160 ? 2 : size >= 720 ? 1 : 0;
  return portrait + sizeScore + (tall > 1.5 ? 0.2 : 0) - (size > 2160 ? 1 : 0);
};
const searchPixabay = async (query) => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const j = await getJson(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=30&safesearch=true`);
  return (j?.hits || []).map((v) => {
    const f = v.videos?.large?.url ? v.videos.large : v.videos?.medium;
    return f?.url && {id: `pixabay-${v.id}`, url: f.url, w: f.width, h: f.height, dur: v.duration, credit: `${v.user || 'Pixabay'} (Pixabay)`};
  }).filter(Boolean);
};

const used = new Set();
const credits = new Set();
const pickClip = async (s, need) => {
  const queries = [s.query, ...(s.alt || [])];
  for (const q of queries) {
    for (const search of [searchPexels, searchPixabay]) {
      const cands = (await search(q)).filter((c) => !used.has(c.id));
      if (!cands.length) continue;
      // 縦長・十分な長さを優先。検索の順位(関連度)も残す
      cands.forEach((c, i) => (c.rank = (c.h > c.w ? 3 : 0) + (c.dur >= need ? 2 : c.dur >= need * 0.6 ? 1 : 0) - i * 0.08));
      cands.sort((a, b) => b.rank - a.rank);
      return {...cands[0], query: q};
    }
  }
  return null;
};

const download = async (url, dest) => {
  if (fs.existsSync(dest)) return;
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 2000 * (k + 1)));
  }
  throw new Error(`素材のダウンロードに失敗: ${url}`);
};

// 1080x1920 に切り抜き、場面の長さちょうどに整える(短い素材はゆっくり再生→それでも足りなければループ)
const ffprobeDur = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()) || 0;
const prepare = (src, dest, seconds, startHint) => {
  const dur = ffprobeDur(src);
  const slow = dur > 0 && dur < seconds ? Math.max(0.6, dur / seconds) : 1; // 0.6倍速まで
  const start = dur > seconds / slow + 1 ? Math.min(startHint, dur - seconds / slow - 0.5) : 0;
  const vf = [`setpts=PTS/${slow}`, `scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`, `fps=${FPS}`, 'format=yuv420p'].join(',');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-stream_loop', '-1', '-ss', String(Math.max(0, start)), '-i', src, '-t', String(seconds), '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', dest]);
};

for (const [i, s] of scenes.entries()) {
  const dest = path.join(clipDir, `c${i}.mp4`);
  const seconds = (s.frames + 2) / FPS;
  if (clipsMode === 'dummy') {
    const hue = (i * 47) % 360;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `gradients=s=${W}x${H}:c0=0x1b4332:c1=0x40916c:speed=0.02:d=${seconds}:r=${FPS}`, '-vf', `hue=h=${hue},format=yuv420p`, '-t', String(seconds), '-c:v', 'libx264', '-preset', 'veryfast', dest]);
    s.clip = `clips/c${i}.mp4`;
    continue;
  }
  const c = await pickClip(script.scenes[i], seconds);
  if (!c) {
    console.error(`${i + 1}番目: 「${[script.scenes[i].query, ...(script.scenes[i].alt || [])].join(' / ')}」の素材が見つかりません`);
    process.exit(1);
  }
  used.add(c.id);
  credits.add(c.credit);
  const raw = path.join(cacheDir, `${c.id}.mp4`);
  await download(c.url, raw);
  prepare(raw, dest, seconds, Number(script.scenes[i].start || 0.5));
  s.clip = `clips/c${i}.mp4`;
  console.log(`${i + 1}番目: ${c.id} 「${c.query}」 ${c.w}x${c.h} ${c.dur}s`);
}

// ── BGM(毎回シードから合成。著作権フリー) ──
const seed = script.seed || `${script.date || ''}-${script.title}`;
execFileSync('python3', [path.join(SHARED, 'bgm.py'), path.join(ROOT, 'public', 'bgm.wav'), '--seconds', String(Math.ceil(totalSec) + 1), '--seed', seed], {stdio: 'inherit'});

// ── レンダリング ──
const total = Math.max(0, ...scenes.map((s) => s.step || 0));
const inputProps = {
  title: script.title,
  label: script.step_label || 'ヒミツ',
  total,
  ranking: script.format === 'ranking',
  cta: script.cta || 'チャンネル登録で毎日いきもの雑学',
  seed,
  bgm: 'bgm.wav',
  bgmVolume: Number(process.env.BGM_VOLUME || 0.12),
  scenes,
};
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts')});
const browserExecutable = process.env.CHROME_PATH || null;
const composition = await selectComposition({serveUrl, id: 'Doubutsu', inputProps, browserExecutable});
fs.mkdirSync(path.dirname(out), {recursive: true});
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 20,
  concurrency: Number(process.env.RENDER_CONCURRENCY || os.cpus().length),
  outputLocation: out,
  inputProps,
  browserExecutable,
  onProgress: ({progress}) => {
    const p = Math.floor(progress * 10);
    if (p !== last) {
      last = p;
      console.log(`レンダリング ${p * 10}%`);
    }
  },
});
console.log(`動画: ${out}`);

// ── 投稿用メタデータ ──
const yt = (script.youtube_title || script.title.replace(/\n/g, '')).slice(0, 90);
const meta = {
  title: yt.includes('#shorts') ? yt : `${yt} #shorts`,
  description: script.description || '',
  tags: script.tags || [],
  credits: [SPEAKER_CREDIT, ...(credits.size ? [`映像: ${[...credits].join(', ')}`] : [])],
  date: script.date || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
  series: script.series || null,
  seconds: Number(totalSec.toFixed(1)),
};
fs.writeFileSync(out.replace(/\.mp4$/, '.meta.json'), JSON.stringify(meta, null, 2));
