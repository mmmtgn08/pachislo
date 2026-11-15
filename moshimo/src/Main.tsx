import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {SCENES} from './three/Scenes';
import {MoshimoProps, Scene, ease, pop, prog} from './lib';

const FONT = '"Noto Sans CJK JP", "Noto Sans JP", "IPAGothic", sans-serif';

const stroke = (w: number, color = '#000'): React.CSSProperties => ({
  WebkitTextStroke: `${w}px ${color}`,
  paintOrder: 'stroke fill',
});

/** 街シーンでの「酸素ゼロ」の瞬間(シーン内フレーム) */
export const cityStopAt = (frames: number) => Math.round(frames * 0.42);

const Title: React.FC<{title: string; badge: string; introFrames: number}> = ({title, badge, introFrames}) => {
  const frame = useCurrentFrame();
  const inIntro = frame < introFrames;
  const t = ease(prog(frame, introFrames, introFrames + 10));
  const s = inIntro ? pop(frame, 0, 10) * (1 + 0.015 * Math.sin(frame * 0.25)) : interpolate(t, [0, 1], [1, 0.72]);
  const top = inIntro ? 620 : interpolate(t, [0, 1], [620, 150]);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', transform: `scale(${s})`, transformOrigin: 'center top'}}>
      <div style={{position: 'relative', background: 'rgba(0,0,0,0.72)', border: '8px solid #ffd400', borderRadius: 36, padding: '34px 46px 30px', maxWidth: 980}}>
        {badge && (
          <div style={{position: 'absolute', top: -40, left: 30, background: '#e11d48', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 40, padding: '6px 26px', borderRadius: 20, border: '4px solid #fff'}}>
            {badge}
          </div>
        )}
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 92, lineHeight: 1.2, color: '#ffe100', textAlign: 'center', whiteSpace: 'pre-line', ...stroke(10, '#9b0000')}}>
          {title}
        </div>
      </div>
    </div>
  );
};

const Telop: React.FC<{text: string; delay: number}> = ({text, delay}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, delay, 8);
  if (s <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 40, right: 40, top: 1080, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 84, lineHeight: 1.25, color: '#fff', textAlign: 'center', whiteSpace: 'pre-line', ...stroke(14)}}>
        {text}
      </div>
    </div>
  );
};

const Countdown: React.FC<{stopAt: number}> = ({stopAt}) => {
  const frame = useCurrentFrame();
  if (frame >= stopAt + 30) return null;
  const step = stopAt / 3;
  const n = frame < stopAt ? 3 - Math.floor(frame / step) : 0;
  const local = frame < stopAt ? frame % step : frame - stopAt;
  const s = pop(local, 0, 6);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: n ? 300 : 150, color: n ? '#fff' : '#ff2d2d', ...stroke(18)}}>
        {n ? n : '酸素 0%'}
      </div>
    </div>
  );
};

const OxygenBadge: React.FC = () => (
  <div style={{position: 'absolute', top: 40, right: 40, background: '#dc2626', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 42, padding: '10px 24px', borderRadius: 18, border: '4px solid #fff'}}>
    O₂ 0%
  </div>
);

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 5], [0.7, 0], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#fff', opacity: o}} />;
};

const Cta: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, 10, 10) * (1 + 0.04 * Math.sin(frame * 0.25));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1420, display: 'flex', justifyContent: 'center', transform: `scale(${s})`}}>
      <div style={{background: '#e11d1d', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 50, padding: '18px 46px', borderRadius: 60, border: '6px solid #fff'}}>
        ▶ {text}
      </div>
    </div>
  );
};

const SceneView: React.FC<{scene: Scene; index: number}> = ({scene, index}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const Comp = SCENES[scene.type];
  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} camera={{fov: 50, position: [0, 0, 8]}}>
        <Comp frame={frame} frames={scene.frames} />
      </ThreeCanvas>
      {index > 0 && <Telop text={scene.telop} delay={index === 1 ? 10 : 2} />}
      {scene.type === 'city' && <Countdown stopAt={cityStopAt(scene.frames)} />}
      {index > 0 && <Flash />}
      {scene.audio && <Audio src={staticFile(scene.audio)} />}
      {scene.se && <Audio src={staticFile(`sfx/${scene.se}.wav`)} volume={0.6} />}
    </AbsoluteFill>
  );
};

export const Main: React.FC<MoshimoProps> = ({title, badge, cta, scenes}) => {
  const frame = useCurrentFrame();
  let acc = 0;
  const starts = scenes.map((s) => {
    const st = acc;
    acc += s.frames;
    return st;
  });
  const cityIdx = scenes.findIndex((s) => s.type === 'city');
  const zeroAt = cityIdx >= 0 ? starts[cityIdx] + cityStopAt(scenes[cityIdx].frames) : Infinity;
  const last = scenes.length - 1;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {scenes.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.frames}>
          <SceneView scene={s} index={i} />
        </Sequence>
      ))}
      <Title title={title} badge={badge} introFrames={scenes[0].frames} />
      {frame >= zeroAt && <OxygenBadge />}
      <Sequence from={starts[last]} durationInFrames={scenes[last].frames}>
        <Cta text={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
