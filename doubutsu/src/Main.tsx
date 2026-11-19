import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame} from 'remotion';

// 画面の安全地帯: 下 約380px(タイトル・チャンネル名)と右 約150px(いいね等のボタン)、上 約120px は Shorts の UI に隠れる
const FONT = '"Noto Sans CJK JP", "Noto Sans JP", "IPAGothic", sans-serif';
const CIRCLED = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export type Scene = {
  text: string;
  telop: string;
  step: number | null; // 何個目の雑学か(フック・締めは null)
  se: string | null;
  audio: string | null;
  clip: string | null;
  frames: number;
};

export type Props = {
  title: string;
  label: string; // 「ヒミツ」「第」など。カウンター表示に使う
  total: number;
  ranking?: boolean; // true なら step を順位として「第3位」と表示
  cta: string;
  seed: string;
  bgm?: string;
  bgmVolume?: number;
  scenes: Scene[];
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pop = (frame: number, start = 0, dur = 8) => {
  const t = (frame - start) / dur;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.6 ? lerp(0.3, 1.12, t / 0.6) : lerp(1.12, 1, (t - 0.6) / 0.4);
};
const stroke = (w: number, color = '#000'): React.CSSProperties => ({WebkitTextStroke: `${w}px ${color}`, paintOrder: 'stroke fill'});
const fitSize = (text: string, maxPx: number, width: number) => {
  const plain = text.replace(/[【】]/g, '');
  const longest = Math.max(...plain.split('\n').map((l) => [...l].reduce((a, ch) => a + (ch.charCodeAt(0) < 128 ? 0.55 : 1), 0)));
  return Math.min(maxPx, Math.floor(width / Math.max(1, longest)));
};

// 見た目のバリエーション(日付とタイトルから決まる)
const THEMES = [
  {accent: '#ffe100', box: 'rgba(0,0,0,0.70)', stroke: '#000', bar: '#22c55e'},
  {accent: '#7df9ff', box: 'rgba(4,40,40,0.78)', stroke: '#002b2b', bar: '#7df9ff'},
  {accent: '#ffb703', box: 'rgba(40,20,0,0.75)', stroke: '#2b1300', bar: '#ffb703'},
  {accent: '#b8ff3b', box: 'rgba(10,35,10,0.78)', stroke: '#0b2a0b', bar: '#b8ff3b'},
];

/** 【】で囲んだ部分を強調色で大きく */
const Rich: React.FC<{line: string; accent: string}> = ({line, accent}) => (
  <>
    {line.split(/(【[^】]*】)/).map((part, i) =>
      part.startsWith('【') ? (
        <span key={i} style={{color: accent, fontSize: '1.18em'}}>{part.slice(1, -1)}</span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )}
  </>
);

const Footage: React.FC<{clip: string | null; frames: number; index: number; seed: string}> = ({clip, frames, index, seed}) => {
  const frame = useCurrentFrame();
  // ゆっくりズーム(ケン・バーンズ)。場面ごとに寄り/引き・方向を変える
  const zoomIn = random(`${seed}-z${index}`) > 0.35;
  const t = frame / Math.max(1, frames);
  const s = zoomIn ? lerp(1.0, 1.1, t) : lerp(1.1, 1.0, t);
  const dx = (random(`${seed}-x${index}`) - 0.5) * 40 * t;
  const enter = interpolate(frame, [0, 5], [1.08, 1], clamp);
  return (
    <AbsoluteFill style={{transform: `scale(${s * enter}) translateX(${dx}px)`}}>
      {clip ? (
        <OffthreadVideo src={staticFile(clip)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      ) : (
        <AbsoluteFill style={{background: 'linear-gradient(#1b4332, #40916c)'}} />
      )}
    </AbsoluteFill>
  );
};

const Telop: React.FC<{text: string; accent: string; strokeColor: string; delay: number}> = ({text, accent, strokeColor, delay}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, delay, 8);
  if (s <= 0 || !text) return null;
  return (
    <div style={{position: 'absolute', left: 40, right: 150, top: 1020, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, color: '#fff', fontSize: fitSize(text, 96, 820), lineHeight: 1.28, textAlign: 'center', whiteSpace: 'pre', ...stroke(16, strokeColor)}}>
        {text.split('\n').map((l, i) => (
          <div key={i}>
            <Rich line={l} accent={accent} />
          </div>
        ))}
      </div>
    </div>
  );
};

/** 雑学が切り替わる瞬間に大きく「ヒミツ②」 */
const stepText = (label: string, step: number, ranking?: boolean) => (ranking ? `第${step}位` : `${label}${CIRCLED[step] ?? step}`);

const StepBanner: React.FC<{label: string; step: number; accent: string; ranking?: boolean}> = ({label, step, accent, ranking}) => {
  const frame = useCurrentFrame();
  if (frame > 26) return null;
  const s = pop(frame, 0, 7);
  const o = interpolate(frame, [18, 26], [1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', transform: `scale(${s})`, opacity: o}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 190, color: accent, ...stroke(20)}}>
        {stepText(label, step, ranking)}
      </div>
    </div>
  );
};

const Title: React.FC<{title: string; introFrames: number; box: string; accent: string}> = ({title, introFrames, box, accent}) => {
  const frame = useCurrentFrame();
  const inIntro = frame < introFrames;
  const t = interpolate(frame, [introFrames, introFrames + 10], [0, 1], clamp);
  const s = inIntro ? pop(frame, 0, 10) : lerp(1, 0.66, t);
  const top = inIntro ? 560 : lerp(560, 140, t);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', transform: `scale(${s})`, transformOrigin: 'center top'}}>
      <div style={{background: box, border: `7px solid ${accent}`, borderRadius: 34, padding: '30px 44px 26px', maxWidth: 980}}>
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: fitSize(title, 96, 870), lineHeight: 1.2, color: '#fff', textAlign: 'center', whiteSpace: 'pre', ...stroke(10)}}>
          {title.split('\n').map((l, i) => (
            <div key={i} style={i === title.split('\n').length - 1 ? {color: accent} : undefined}>
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 「ヒミツ ②/3」と進み具合のバー */
const Counter: React.FC<{label: string; step: number; total: number; progress: number; accent: string; bar: string; ranking?: boolean}> = ({label, step, total, progress, accent, bar, ranking}) => (
  <div style={{position: 'absolute', left: 60, right: 170, top: 400, display: 'flex', alignItems: 'center', gap: 22}}>
    <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 50, color: '#fff', background: 'rgba(0,0,0,0.6)', border: `4px solid ${accent}`, borderRadius: 18, padding: '4px 20px', whiteSpace: 'nowrap'}}>
      {ranking ? (
        <>
          第<span style={{color: accent}}>{step}</span>位
        </>
      ) : (
        <>
          {label} <span style={{color: accent}}>{CIRCLED[step] ?? step}</span>/{total}
        </>
      )}
    </div>
    <div style={{flex: 1, height: 16, background: 'rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden'}}>
      <div style={{width: `${progress * 100}%`, height: '100%', background: bar}} />
    </div>
  </div>
);

const Cta: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, 10, 10) * (1 + 0.04 * Math.sin(frame * 0.25));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1400, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{background: '#e11d1d', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 48, padding: '16px 44px', borderRadius: 60, border: '6px solid #fff'}}>▶ {text}</div>
    </div>
  );
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 5], [0.55, 0], clamp);
  return <AbsoluteFill style={{background: '#fff', opacity: o}} />;
};

export const Main: React.FC<Props> = ({title, label, total, ranking, cta, seed, bgm, bgmVolume = 0.12, scenes}) => {
  const frame = useCurrentFrame();
  const th = THEMES[Math.floor(random(`${seed}-theme`) * THEMES.length) % THEMES.length];
  let acc = 0;
  const starts = scenes.map((s) => {
    const v = acc;
    acc += s.frames;
    return v;
  });
  const last = scenes.length - 1;
  let cur = 0;
  starts.forEach((st, i) => {
    if (frame >= st) cur = i;
  });
  // いま何個目か(直近の step を引き継ぐ)
  let step = 0;
  for (let i = 0; i <= cur; i++) if (scenes[i].step) step = scenes[i].step!;
  const firstStep = starts[scenes.findIndex((s) => s.step)] ?? Infinity;
  const lastEnd = starts[last];
  const progress = interpolate(frame, [firstStep, lastEnd], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {bgm && <Audio src={staticFile(bgm)} volume={bgmVolume} />}
      {scenes.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.frames}>
          <Footage clip={s.clip} frames={s.frames} index={i} seed={seed} />
          {/* 文字を読みやすくする上下の影 */}
          <AbsoluteFill style={{background: 'linear-gradient(rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.5) 75%, rgba(0,0,0,0.65) 100%)'}} />
          {i > 0 && <Telop text={s.telop} accent={th.accent} strokeColor={th.stroke} delay={s.step && s.step !== scenes[i - 1].step ? 14 : 3} />}
          {i > 0 && s.step && s.step !== scenes[i - 1].step && <StepBanner label={label} step={s.step} accent={th.accent} ranking={ranking} />}
          {i > 0 && <Flash />}
          {s.audio && <Audio src={staticFile(s.audio)} />}
          {s.se && <Audio src={staticFile(`sfx/${s.se}.wav`)} volume={0.55} />}
        </Sequence>
      ))}
      <Title title={title} introFrames={scenes[0].frames} box={th.box} accent={th.accent} />
      {total > 0 && step > 0 && <Counter label={label} step={step} total={total} progress={progress} accent={th.accent} bar={th.bar} ranking={ranking} />}
      <Sequence from={starts[last]} durationInFrames={scenes[last].frames}>
        <Cta text={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
