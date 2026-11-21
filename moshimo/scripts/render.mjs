// 台本JSON → VOICEVOX ナレーション → Remotion で mp4 を書き出す
//   node scripts/render.mjs topics/oxygen.json --out out/video.mp4 [--tts dummy]
// 台本に chapters があれば長尺動画(16:9・章立て)として書き出し、サムネイルも作る(GUIDE_LONG.md)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const SPEAKER = Number(process.env.VOICE_SPEAKER || 13); // 13 = 青山龍星
const SPEAKER_CREDIT = process.env.VOICE_CREDIT || 'VOICEVOX:青山龍星';
const SPEED = Number(process.env.VOICE_SPEED || 1.15);
const VOICEVOX = (process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').replace(/\/$/, '');
const SCENE_TYPES = ['earthIntro', 'city', 'fire', 'park', 'ocean', 'crumble', 'earthEnd', 'space', 'sky', 'underwater', 'room', 'animals', 'farm'];
const EVENTS = ['none', 'stall', 'float', 'dark', 'freeze', 'wind', 'vanish', 'ears', 'cheer', 'out', 'grow', 'rain', 'meteor', 'explode', 'tsunami', 'burn', 'wither', 'crumble', 'ice', 'fine', 'impact'];
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
const LONG = Array.isArray(script.chapters);
const errors = [];
if (!script.title) errors.push('title がありません');
const checkScenes = (scenes, where, min, max, maxText) => {
  if (!Array.isArray(scenes) || scenes.length < min || scenes.length > max) errors.push(`${where}scenes は${min}〜${max}個`);
  for (const [i, s] of (scenes || []).entries()) {
    const at = `${where}${i + 1}番目`;
    if (!SCENE_TYPES.includes(s.type)) errors.push(`${at}: type は ${SCENE_TYPES.join('/')} のいずれか`);
    if (!s.text || s.text.length > maxText) errors.push(`${at}: text は1〜${maxText}文字`);
    if (s.event && !EVENTS.includes(s.event)) errors.push(`${at}: event は ${EVENTS.join('/')} のいずれか`);
    if (s.se && !SE_NAMES.includes(s.se)) errors.push(`${at}: se は ${SE_NAMES.join('/')} のいずれか`);
  }
};
if (LONG) {
  if (script.chapters.length < 3 || script.chapters.length > 10) errors.push('chapters は3〜10個');
  if (!script.intro_text || script.intro_text.length > 200) errors.push('intro_text は1〜200文字');
  if (!script.outro_text || script.outro_text.length > 200) errors.push('outro_text は1〜200文字');
  script.chapters.forEach((c, j) => {
    if (!c.title) errors.push(`第${j + 1}章: title がありません`);
    if (!c.chapter_title || c.chapter_title.length > 20) errors.push(`第${j + 1}章: chapter_title は1〜20文字`);
    checkScenes(c.scenes, `第${j + 1}章の`, 5, 20, 120);
  });
} else {
  checkScenes(script.scenes, '', 4, 12, 80);
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

// 1つのナレーションを合成して {audio, seconds} を返す
const synth = async (text, name) => {
  if (tts !== 'voicevox') return {audio: null, seconds: 0.6 + text.length * 0.11};
  const q = await (await fetch(`${VOICEVOX}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`, {method: 'POST'})).json();
  Object.assign(q, {speedScale: SPEED, intonationScale: 1.2, prePhonemeLength: 0.05, postPhonemeLength: 0.1});
  const r = await fetch(`${VOICEVOX}/synthesis?speaker=${SPEAKER}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(q)});
  if (!r.ok) throw new Error(`合成失敗: ${await r.text()}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(voiceDir, `${name}.wav`), buf);
  return {audio: `voice/${name}.wav`, seconds: wavSeconds(buf)};
};
const buildScenes = async (list, prefix) => {
  const out = [];
  for (const [i, s] of list.entries()) {
    const {audio, seconds} = await synth(s.text, `${prefix}${i}`);
    const frames = Math.max(45, Math.ceil((seconds + 0.25) * FPS));
    out.push({type: s.type, event: s.event || undefined, countdown: !!s.countdown, time: typeof s.time === 'number' ? s.time : undefined, text: s.text, telop: s.telop || '', se: s.se || null, audio, frames});
  }
  return out;
};
const timerOf = (sc) =>
  sc.timer_duration === 0
    ? null
    : {
        duration: Number(sc.timer_duration ?? 5),
        decimals: Math.max(0, Math.min(2, Number(sc.timer_decimals ?? 1))),
        unit: sc.timer_unit || '秒',
        label: sc.timer_label || '経過',
      };

const CARD_FRAMES = 75; // 章の扉 2.5秒
let scenes = [];
let longProps = null;
let chapterMarks = [];
let totalSec;
if (LONG) {
  const seedBase = script.seed || `${script.date || ''}-${script.title}`;
  const intro = await synth(script.intro_text, 'intro');
  const outro = await synth(script.outro_text, 'outro');
  const seg = (x, min) => ({text: '', audio: x.audio, frames: Math.max(min, Math.ceil((x.seconds + 0.6) * FPS))});
  const chapters = [];
  let at = seg(intro, 150).frames;
  chapterMarks.push([0, 'オープニング']);
  for (const [j, c] of script.chapters.entries()) {
    const sc = await buildScenes(c.scenes, `c${j}s`);
    chapterMarks.push([at, `第${j + 1}章 ${c.chapter_title}`]);
    chapters.push({
      title: c.title,
      chapterTitle: c.chapter_title,
      badge: `第${j + 1}章`,
      cta: '',
      zeroLabel: c.zero_label || 'ゼロ',
      statusLabel: c.status_label || '',
      seed: `${seedBase}-${j}`,
      timer: timerOf(c),
      scenes: sc,
    });
    at += CARD_FRAMES + sc.reduce((a, s) => a + s.frames, 0);
  }
  chapterMarks.push([at, 'エンディング']);
  longProps = {title: script.title, seed: seedBase, intro: seg(intro, 150), outro: seg(outro, 120), cardFrames: CARD_FRAMES, chapters};
  totalSec = (at + longProps.outro.frames) / FPS;
  console.log(`長さ: ${Math.floor(totalSec / 60)}分${Math.round(totalSec % 60)}秒（${chapters.length}章）`);
  if (totalSec < 8 * 60) console.warn('::warning::8分未満です。8分以上にすると動画の途中にも広告を入れられます');
  if (totalSec > 20 * 60) {
    console.error('20分を超えています。台本を短くしてください');
    process.exit(1);
  }
} else {
  scenes = await buildScenes(script.scenes, 's');
  totalSec = scenes.reduce((a, s) => a + s.frames, 0) / FPS;
  console.log(`長さ: ${totalSec.toFixed(1)}秒`);
  if (totalSec > 59.5) {
    console.error('60秒を超えています。台本を短くしてください');
    process.exit(1);
  }
}

// ── BGM(毎回シードから合成。著作権フリー) ──
const bgmSeed = script.seed || `${script.date || ''}-${script.title}`;
execFileSync('python3', [path.join(ROOT, 'tools', 'bgm.py'), path.join(ROOT, 'public', 'bgm.wav'), '--seconds', String(Math.ceil(totalSec) + 1), '--seed', bgmSeed], {stdio: 'inherit'});

// ── シリーズ回数 ──
const histPath = path.join(ROOT, 'history.jsonl');
const hist = fs.existsSync(histPath) ? fs.readFileSync(histPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const episode = script.series ? hist.filter((h) => h.series === script.series && (h.format || 'short') === (LONG ? 'long' : 'short')).length + 1 : null;
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
  // 左の経過時間タイマー。timer_duration: 0 で非表示
  timer: timerOf(script),
  bgm: 'bgm.wav',
  bgmVolume: Number(process.env.BGM_VOLUME || 0.15),
  scenes,
};
const props = LONG ? {...longProps, bgm: 'bgm.wav', bgmVolume: Number(process.env.BGM_VOLUME || 0.12)} : inputProps;
const compId = LONG ? 'MoshimoLong' : 'Moshimo';
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts')});
const browserExecutable = process.env.CHROME_PATH || null;
const composition = await selectComposition({serveUrl, id: compId, inputProps: props, browserExecutable, chromiumOptions: {gl: 'swangle'}});
fs.mkdirSync(path.dirname(out), {recursive: true});
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 20,
  concurrency: Number(process.env.RENDER_CONCURRENCY || os.cpus().length),
  outputLocation: out,
  inputProps: props,
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

// ── サムネイル(長尺のみ。ショートは YouTube が自動で選ぶ) ──
let thumbnail = null;
if (LONG) {
  const tp = {text: script.thumbnail_text || script.title, sub: script.thumbnail_sub || '', seed, scene: script.thumbnail_scene || 'earthEnd', event: script.thumbnail_event || 'impact'};
  const tc = await selectComposition({serveUrl, id: 'Thumbnail', inputProps: tp, browserExecutable, chromiumOptions: {gl: 'swangle'}});
  thumbnail = out.replace(/\.mp4$/, '.thumb.png');
  await renderStill({composition: tc, serveUrl, output: thumbnail, inputProps: tp, browserExecutable, chromiumOptions: {gl: 'swangle'}});
  console.log(`サムネイル: ${thumbnail}`);
}
const stamp = (f) => {
  const t = Math.floor(f / FPS);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// ── 投稿用メタデータ ──
const yt = (script.youtube_title || script.title.replace(/\n/g, '')).slice(0, 90);
const meta = {
  title: LONG ? yt.replace(/\s*#shorts/g, '') : yt.includes('#shorts') ? yt : `${yt} #shorts`,
  description: LONG ? `${script.description || ''}\n\n${chapterMarks.map(([f, t]) => `${stamp(f)} ${t}`).join('\n')}` : script.description || '',
  tags: script.tags || [],
  credits: [SPEAKER_CREDIT],
  notice: '',
  // 履歴用
  date: script.date || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
  series: script.series || null,
  episode,
  seconds: Number(totalSec.toFixed(1)),
  format: LONG ? 'long' : 'short',
  thumbnail: thumbnail ? path.basename(thumbnail) : null,
};
fs.writeFileSync(out.replace(/\.mp4$/, '.meta.json'), JSON.stringify(meta, null, 2));
