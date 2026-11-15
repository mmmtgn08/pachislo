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
    <div style={{position: 'absolute', left: 40, right: 40, top: 1080, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: fitSize(text, 84, 940), lineHeight: 1.25, textAlign: 'center', whiteSpace: 'pre', ...stroke(14, st.telop.stroke)}}>
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
    <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: n ? 300 : 140, color: n ? '#fff' : '#ff2d2d', ...stroke(18)}}>{n ? n : label}</div>
    </div>
  );
};

const StatusBadge: React.FC<{label: string}> = ({label}) => (
  <div style={{position: 'absolute', top: 40, right: 40, background: '#dc2626', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 42, padding: '10px 24px', borderRadius: 18, border: '4px solid #fff'}}>
    {label}
  </div>
);

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
  return (
    <AbsoluteFill>
      <AbsoluteFill style={tr.wrap}>
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

export const Main: React.FC<MoshimoProps> = ({title, badge, cta, zeroLabel, statusLabel, seed, scenes}) => {
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
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {scenes.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.frames}>
          <SceneView scene={s} index={i} st={st} showCountdown={i === cdIdx} zeroLabel={zeroLabel} />
        </Sequence>
      ))}
      <Title title={title} badge={badge} introFrames={scenes[0].frames} st={st} />
      {statusLabel && frame >= zeroAt && <StatusBadge label={statusLabel} />}
      <Sequence from={starts[last]} durationInFrames={scenes[last].frames}>
        <Cta text={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
