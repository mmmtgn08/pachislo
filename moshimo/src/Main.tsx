import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {SCENES} from './three/Scenes';
import {eventAt} from './three/events';
import {MoshimoProps, Scene, Style, ease, makeStyle, pop, prog} from './lib';

const FONT = '"Noto Sans CJK JP", "Noto Sans JP", "IPAGothic", sans-serif';

/** 一番長い行が収まるフォントサイズ */
const fitSize = (text: string, maxPx: number, width: number) => {
  const longest = Math.max(...text.split('\n').map((l) => [...l].reduce((a, ch) => a + (ch.charCodeAt(0) < 128 ? 0.55 : 1), 0)));
  return Math.min(maxPx, Math.floor(width / Math.max(1, longest)));
};

const stroke = (w: number, color = '#000'): React.CSSProperties => ({
  WebkitTextStroke: `${w}px ${color}`,
  paintOrder: 'stroke fill',
});

const Title: React.FC<{title: string; badge: string; introFrames: number; st: Style}> = ({title, badge, introFrames, st}) => {
  const frame = useCurrentFrame();
  const inIntro = frame < introFrames;
  const t = ease(prog(frame, introFrames, introFrames + 10));
  const s = inIntro ? pop(frame, 0, 10) * (1 + 0.015 * Math.sin(frame * 0.25)) : interpolate(t, [0, 1], [1, 0.72]);
  const top = inIntro ? 620 : interpolate(t, [0, 1], [620, 150]);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', transform: `scale(${s})`, transformOrigin: 'center top'}}>
      <div style={{position: 'relative', background: st.title.box, border: `8px solid ${st.title.border}`, borderRadius: 36, padding: '34px 46px 30px', maxWidth: 980}}>
        {badge && (
          <div style={{position: 'absolute', top: -40, left: 30, background: '#e11d48', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 40, padding: '6px 26px', borderRadius: 20, border: '4px solid #fff'}}>
            {badge}
          </div>
        )}
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: fitSize(title, 92, 860), lineHeight: 1.2, color: st.title.fg, textAlign: 'center', whiteSpace: 'pre', ...stroke(10, st.title.stroke)}}>
          {title}
        </div>
      </div>
    </div>
  );
};

const Telop: React.FC<{text: string; delay: number; st: Style}> = ({text, delay, st}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, delay, 8);
  if (s <= 0 || !text) return null;
  // 2行目(結果)を強調色にする
  const [first, ...rest] = text.split('\n');
  return (
    <div style={{position: 'absolute', left: 40, right: 150, top: 1080, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: fitSize(text, 84, 820), lineHeight: 1.25, textAlign: 'center', whiteSpace: 'pre', ...stroke(14, st.telop.stroke)}}>
        <div style={{color: st.telop.fg}}>{first}</div>
        {rest.length > 0 && <div style={{color: st.telop.emph}}>{rest.join('\n')}</div>}
      </div>
    </div>
  );
};

const Countdown: React.FC<{at: number; label: string}> = ({at, label}) => {
  const frame = useCurrentFrame();
  if (frame >= at + 30) return null;
  const step = at / 3;
  const n = frame < at ? 3 - Math.floor(frame / step) : 0;
  const local = frame < at ? frame % step : frame - at;
  const s = pop(local, 0, 6);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: n ? 300 : 140, color: n ? '#fff' : '#ff2d2d', ...stroke(18)}}>{n ? n : label}</div>
    </div>
  );
};

const StatusBadge: React.FC<{label: string}> = ({label}) => (
  <div style={{position: 'absolute', top: 380, right: 60, background: '#dc2626', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 42, padding: '10px 24px', borderRadius: 18, border: '4px solid #fff'}}>
    {label}
  </div>
);

/** 左の経過時間タイマー(物語の中の時間) */
const Timer: React.FC<{value: number; total: number; decimals: number; unit: string; label: string; done: boolean}> = ({value, total, decimals, unit, label, done}) => {
  const frame = useCurrentFrame();
  const p = Math.min(1, value / Math.max(0.0001, total));
  const r = 54, circ = 2 * Math.PI * r;
  return (
    <div style={{position: 'absolute', left: 34, top: 470, display: 'flex', alignItems: 'center', gap: 10}}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={64} cy={64} r={r} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.25)" strokeWidth={10} />
        <circle cx={64} cy={64} r={r} fill="none" stroke={done ? '#22c55e' : '#ff3b3b'} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${circ * p} ${circ}`} transform="rotate(-90 64 64)" />
        <text x={64} y={74} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={30} fill="#fff">{label}</text>
      </svg>
      <div style={{fontFamily: FONT, fontWeight: 900, color: done ? '#86efac' : '#ffffff', ...stroke(12), lineHeight: 1}}>
        <span style={{fontSize: 150, fontVariantNumeric: 'tabular-nums'}}>{value.toFixed(decimals)}</span>
        <span style={{fontSize: 70, marginLeft: 6}}>{unit}</span>
      </div>
    </div>
  );
};

/** シーン切り替え演出 */
const useTransition = (kind: Style['transition'], enabled: boolean): {wrap: React.CSSProperties; overlay: React.ReactNode} => {
  const frame = useCurrentFrame();
  if (!enabled) return {wrap: {}, overlay: null};
  if (kind === 'flash') {
    const o = interpolate(frame, [0, 5], [0.7, 0], {extrapolateRight: 'clamp'});
    return {wrap: {}, overlay: <AbsoluteFill style={{background: '#fff', opacity: o}} />};
  }
  if (kind === 'dip') {
    const o = interpolate(frame, [0, 6], [1, 0], {extrapolateRight: 'clamp'});
    return {wrap: {}, overlay: <AbsoluteFill style={{background: '#000', opacity: o}} />};
  }
  if (kind === 'zoom') {
    const s = interpolate(frame, [0, 7], [1.25, 1], {extrapolateRight: 'clamp'});
    return {wrap: {transform: `scale(${s})`}, overlay: null};
  }
  const x = interpolate(frame, [0, 6], [100, 0], {extrapolateRight: 'clamp'});
  return {wrap: {transform: `translateX(${x}%)`}, overlay: null};
};

const SceneView: React.FC<{scene: Scene; index: number; st: Style; showCountdown: boolean; zeroLabel: string}> = ({scene, index, st, showCountdown, zeroLabel}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const Comp = SCENES[scene.type];
  const tr = useTransition(st.transition, index > 0);
  // 爆発・隕石・衝突で画面を揺らす
  const shakeAt = scene.type === 'earthEnd' ? Math.round(scene.frames * 0.35) : eventAt(scene.frames) + (scene.type === 'space' ? 20 : 0);
  const shaky = ['explode', 'meteor', 'impact'].includes(scene.event ?? '') && frame >= shakeAt && frame < shakeAt + 24;
  const sk = shaky ? (1 - (frame - shakeAt) / 24) * 18 : 0;
  const shakeStyle: React.CSSProperties = sk ? {transform: `translate(${Math.sin(frame * 7.3) * sk}px, ${Math.cos(frame * 9.1) * sk}px)`} : {};
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{...tr.wrap, ...shakeStyle}}>
        <ThreeCanvas width={width} height={height} shadows camera={{fov: 50, position: [0, 0, 8]}}>
          <Comp frame={frame} frames={scene.frames} style={st} event={scene.event} variant={(st.cam + index) % 3} />
        </ThreeCanvas>
      </AbsoluteFill>
      {index > 0 && <Telop text={scene.telop} delay={index === 1 ? 10 : 3} st={st} />}
      {showCountdown && <Countdown at={eventAt(scene.frames)} label={zeroLabel} />}
      {tr.overlay}
      {scene.audio && <Audio src={staticFile(scene.audio)} />}
      {scene.se && <Audio src={staticFile(`sfx/${scene.se}.wav`)} volume={0.6} />}
    </AbsoluteFill>
  );
};

const Cta: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, 10, 10) * (1 + 0.04 * Math.sin(frame * 0.25));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1420, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{background: '#e11d1d', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 50, padding: '18px 46px', borderRadius: 60, border: '6px solid #fff'}}>▶ {text}</div>
    </div>
  );
};

export const Main: React.FC<MoshimoProps> = ({title, badge, cta, zeroLabel, statusLabel, seed, timer, bgm, bgmVolume = 0.15, scenes}) => {
  const frame = useCurrentFrame();
  const st = makeStyle(seed || title);
  let acc = 0;
  const starts = scenes.map((s) => {
    const v = acc;
    acc += s.frames;
    return v;
  });
  let cdIdx = scenes.findIndex((s) => s.countdown);
  if (cdIdx < 0) cdIdx = scenes.findIndex((s, i) => i > 0 && s.type !== 'earthEnd');
  const zeroAt = cdIdx >= 0 ? starts[cdIdx] + eventAt(scenes[cdIdx].frames) : Infinity;
  const last = scenes.length - 1;
  // 物語の時間: 「ゼロ」の瞬間=0 → 各場面の time → 最後の場面の開始で duration に到達
  let storyTime = 0;
  if (timer && frame >= zeroAt) {
    const anchors: [number, number][] = [[zeroAt, 0]];
    scenes.forEach((s, i) => {
      if (s.time !== undefined && starts[i] > zeroAt) anchors.push([starts[i], s.time]);
    });
    const endFrame = scenes[last].type === 'earthEnd' ? starts[last] : starts[last] + scenes[last].frames;
    if (!anchors.some(([, t]) => t >= timer.duration)) anchors.push([Math.max(endFrame, zeroAt + 1), timer.duration]);
    anchors.sort((a, b) => a[0] - b[0]);
    storyTime = anchors[anchors.length - 1][1];
    for (let k = 0; k < anchors.length - 1; k++) {
      const [f0, t0] = anchors[k], [f1, t1] = anchors[k + 1];
      if (frame < f1) {
        storyTime = t0 + (t1 - t0) * Math.max(0, (frame - f0) / Math.max(1, f1 - f0));
        break;
      }
    }
    storyTime = Math.min(storyTime, timer.duration);
  }
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {bgm && <Audio src={staticFile(bgm)} volume={bgmVolume} />}
      {scenes.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.frames}>
          <SceneView scene={s} index={i} st={st} showCountdown={i === cdIdx} zeroLabel={zeroLabel} />
        </Sequence>
      ))}
      <Title title={title} badge={badge} introFrames={scenes[0].frames} st={st} />
      {statusLabel && frame >= zeroAt && <StatusBadge label={statusLabel} />}
      {timer && frame >= zeroAt && (
        <Timer value={storyTime} total={timer.duration} decimals={timer.decimals} unit={timer.unit} label={timer.label} done={storyTime >= timer.duration} />
      )}
      <Sequence from={starts[last]} durationInFrames={scenes[last].frames}>
        <Cta text={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
