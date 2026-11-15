// 台本JSON → VOICEVOX ナレーション → Remotion で mp4 を書き出す
//   node scripts/render.mjs topics/oxygen.json --out out/video.mp4 [--tts dummy]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const SPEAKER = Number(process.env.VOICE_SPEAKER || 13); // 13 = 青山龍星
const SPEAKER_CREDIT = process.env.VOICE_CREDIT || 'VOICEVOX:青山龍星';
const SPEED = Number(process.env.VOICE_SPEED || 1.15);
const VOICEVOX = (process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').replace(/\/$/, '');
const SCENE_TYPES = ['earthIntro', 'city', 'fire', 'park', 'ocean', 'crumble', 'earthEnd'];
const EVENTS = ['none', 'stall', 'float', 'dark', 'freeze', 'wind', 'vanish', 'ears', 'cheer', 'out', 'grow', 'crumble', 'ice', 'fine'];
const SE_NAMES = ['pop', 'don', 'peka', 'chan', 'boo', 'whoosh', 'kira'];

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const scriptPath = args[0];
const out = path.resolve(opt('--out', 'out/video.mp4'));
const tts = opt('--tts', 'voicevox');

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));

// ── 検証 ──
const errors = [];
if (!script.title) errors.push('title がありません');
if (!Array.isArray(script.scenes) || script.scenes.length < 4 || script.scenes.length > 12) errors.push('scenes は4〜12個');
for (const [i, s] of (script.scenes || []).entries()) {
  if (!SCENE_TYPES.includes(s.type)) errors.push(`${i + 1}番目: type は ${SCENE_TYPES.join('/')} のいずれか`);
  if (!s.text || s.text.length > 80) errors.push(`${i + 1}番目: text は1〜80文字`);
  if (s.event && !EVENTS.includes(s.event)) errors.push(`${i + 1}番目: event は ${EVENTS.join('/')} のいずれか`);
  if (s.se && !SE_NAMES.includes(s.se)) errors.push(`${i + 1}番目: se は ${SE_NAMES.join('/')} のいずれか`);
}
if (errors.length) {
  console.error('台本エラー:\n' + errors.join('\n'));
  process.exit(1);
}

// ── 効果音 ──
const sfxDir = path.join(ROOT, 'public', 'sfx');
if (!fs.existsSync(path.join(sfxDir, 'don.wav'))) {
  execFileSync('python3', [path.join(ROOT, 'tools', 'sfx.py'), sfxDir], {stdio: 'inherit'});
}

// ── ナレーション ──
const wavSeconds = (buf) => {
  // RIFF ヘッダから data チャンクを探す
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
    Object.assign(q, {speedScale: SPEED, intonationScale: 1.2, prePhonemeLength: 0.05, postPhonemeLength: 0.1});
    const r = await fetch(`${VOICEVOX}/synthesis?speaker=${SPEAKER}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(q)});
    if (!r.ok) throw new Error(`合成失敗: ${await r.text()}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(voiceDir, `s${i}.wav`), buf);
    seconds = wavSeconds(buf);
    audio = `voice/s${i}.wav`;
  } else {
    seconds = 0.6 + s.text.length * 0.11;
  }
  const frames = Math.max(45, Math.ceil((seconds + 0.25) * FPS));
  scenes.push({type: s.type, event: s.event || undefined, countdown: !!s.countdown, text: s.text, telop: s.telop || '', se: s.se || null, audio, frames});
}
const totalSec = scenes.reduce((a, s) => a + s.frames, 0) / FPS;
console.log(`長さ: ${totalSec.toFixed(1)}秒`);
if (totalSec > 59.5) {
  console.error('60秒を超えています。台本を短くしてください');
  process.exit(1);
}

// ── シリーズ回数 ──
const histPath = path.join(ROOT, 'history.jsonl');
const hist = fs.existsSync(histPath) ? fs.readFileSync(histPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const episode = script.series ? hist.filter((h) => h.series === script.series).length + 1 : null;
const badge = script.series ? `${script.series} #${episode}` : '';

// ── レンダリング ──
const seed = script.seed || `${script.date || ''}-${script.title}`;
const inputProps = {
  title: script.title,
  badge,
  cta: script.cta || 'チャンネル登録で毎日「もしも」',
  zeroLabel: script.zero_label || 'ゼロ',
  statusLabel: script.status_label || '',
  seed,
  scenes,
};
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts')});
const browserExecutable = process.env.CHROME_PATH || null;
const composition = await selectComposition({serveUrl, id: 'Moshimo', inputProps, browserExecutable, chromiumOptions: {gl: 'swangle'}});
fs.mkdirSync(path.dirname(out), {recursive: true});
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 20,
  outputLocation: out,
  inputProps,
  browserExecutable,
  chromiumOptions: {gl: 'swangle'},
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
  credits: [SPEAKER_CREDIT],
  notice: '',
  // 履歴用
  date: script.date || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
  series: script.series || null,
  episode,
  seconds: Number(totalSec.toFixed(1)),
};
fs.writeFileSync(out.replace(/\.mp4$/, '.meta.json'), JSON.stringify(meta, null, 2));
