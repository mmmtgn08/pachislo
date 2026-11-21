// 長尺動画(16:9)とサムネイル。各章は Main(ショートと同じ演出)をそのまま並べる。
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {Main} from './Main';
import {SCENES} from './three/Scenes';
import {MoshimoProps, ease, makeStyle, pop, prog} from './lib';

const FONT = '"Noto Sans CJK JP", "Noto Sans JP", "IPAGothic", sans-serif';
const stroke = (w: number, color = '#000'): React.CSSProperties => ({WebkitTextStroke: `${w}px ${color}`, paintOrder: 'stroke fill'});

export type Segment = {text: string; audio?: string | null; frames: number};
export type LongProps = {
  title: string;
  seed: string;
  intro: Segment;
  outro: Segment;
  cardFrames: number;
  chapters: (MoshimoProps & {chapterTitle: string})[];
  bgm?: string;
  bgmVolume?: number;
};

export const chapterFrames = (c: MoshimoProps) => c.scenes.reduce((a, s) => a + s.frames, 0);
export const longFrames = (p: LongProps) =>
  p.intro.frames + p.outro.frames + p.chapters.reduce((a, c) => a + p.cardFrames + chapterFrames(c), 0);

const Bg: React.FC<{type: string; event?: string; frames: number; seed: string; dim?: number}> = ({type, event, frames, seed, dim = 0.35}) => {
  const frame = useCurrentFrame();
  const Comp = SCENES[type];
  const st = makeStyle(seed);
  return (
    <AbsoluteFill>
      <ThreeCanvas width={1920} height={1080} shadows camera={{fov: 50, position: [0, 0, 8]}}>
        <Comp frame={frame} frames={frames} style={st} event={event as any} variant={st.cam % 3} />
      </ThreeCanvas>
      <AbsoluteFill style={{background: `rgba(0,0,0,${dim})`}} />
    </AbsoluteFill>
  );
};

const Intro: React.FC<{p: LongProps}> = ({p}) => {
  const frame = useCurrentFrame();
  const st = makeStyle(p.seed);
  return (
    <AbsoluteFill>
      <Bg type="earthIntro" frames={p.intro.frames} seed={p.seed} dim={0.25} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', transform: `scale(${pop(frame, 0, 12)})`}}>
        <div style={{background: st.title.box, border: `8px solid ${st.title.border}`, borderRadius: 36, padding: '28px 56px', maxWidth: 1600}}>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 96, lineHeight: 1.2, color: st.title.fg, textAlign: 'center', whiteSpace: 'pre', ...stroke(10, st.title.stroke)}}>{p.title}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 360, right: 360, top: 470, display: 'flex', flexDirection: 'column', gap: 18, background: 'rgba(0,0,0,0.55)', borderRadius: 28, padding: '32px 56px', opacity: ease(prog(frame, 14, 22))}}>
        {p.chapters.map((c, i) => {
          const s = ease(prog(frame, 20 + i * 8, 32 + i * 8));
          return (
            <div key={i} style={{opacity: s, transform: `translateX(${(1 - s) * 80}px)`, fontFamily: FONT, fontWeight: 900, fontSize: 52, color: '#fff', ...stroke(8)}}>
              <span style={{color: st.telop.emph, marginRight: 24}}>第{i + 1}章</span>
              {c.chapterTitle}
            </div>
          );
        })}
      </div>
      {p.intro.audio && <Audio src={staticFile(p.intro.audio)} />}
      <Audio src={staticFile('sfx/don.wav')} volume={0.6} />
    </AbsoluteFill>
  );
};

const Card: React.FC<{n: number; title: string; frames: number; seed: string}> = ({n, title, frames, seed}) => {
  const frame = useCurrentFrame();
  const st = makeStyle(seed);
  const out = ease(prog(frame, frames - 8, frames));
  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      <Bg type="space" event="none" frames={frames} seed={`${seed}-${n}`} dim={0.5} />
      <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20}}>
        <div style={{transform: `scale(${pop(frame, 0, 10)})`, background: '#e11d48', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 64, padding: '8px 40px', borderRadius: 24, border: '5px solid #fff'}}>第{n}章</div>
        <div style={{transform: `scale(${pop(frame, 6, 10)})`, fontFamily: FONT, fontWeight: 900, fontSize: 110, color: st.title.fg, textAlign: 'center', ...stroke(12, st.title.stroke)}}>{title}</div>
      </AbsoluteFill>
      <Audio src={staticFile('sfx/chan.wav')} volume={0.6} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<{p: LongProps}> = ({p}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg type="earthEnd" event="dark" frames={p.outro.frames} seed={`${p.seed}-end`} dim={0.3} />
      <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 50}}>
        <div style={{transform: `scale(${pop(frame, 0, 10)})`, fontFamily: FONT, fontWeight: 900, fontSize: 90, color: '#fff', ...stroke(12)}}>最後まで見てくれてありがとう！</div>
        <div style={{transform: `scale(${pop(frame, 12, 10) * (1 + 0.04 * Math.sin(frame * 0.25))})`, background: '#e11d1d', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 60, padding: '20px 56px', borderRadius: 70, border: '6px solid #fff'}}>
          ▶ チャンネル登録で毎日「もしも」
        </div>
      </AbsoluteFill>
      {p.outro.audio && <Audio src={staticFile(p.outro.audio)} />}
    </AbsoluteFill>
  );
};

export const LongMain: React.FC<LongProps> = (p) => {
  let at = p.intro.frames;
  const blocks = p.chapters.map((c, i) => {
    const card = at;
    const body = at + p.cardFrames;
    at = body + chapterFrames(c);
    return {c, i, card, body};
  });
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {p.bgm && <Audio src={staticFile(p.bgm)} volume={p.bgmVolume ?? 0.12} />}
      <Sequence durationInFrames={p.intro.frames}>
        <Intro p={p} />
      </Sequence>
      {blocks.map(({c, i, card, body}) => (
        <React.Fragment key={i}>
          <Sequence from={card} durationInFrames={p.cardFrames}>
            <Card n={i + 1} title={c.chapterTitle} frames={p.cardFrames} seed={p.seed} />
          </Sequence>
          <Sequence from={body} durationInFrames={chapterFrames(c)}>
            <Main {...c} bgm={undefined} />
          </Sequence>
        </React.Fragment>
      ))}
      <Sequence from={at} durationInFrames={p.outro.frames}>
        <Outro p={p} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** サムネイル(1280×720 の静止画) */
export type ThumbProps = {text: string; sub?: string; seed: string; scene?: string; event?: string};
export const Thumbnail: React.FC<ThumbProps> = ({text, sub, seed, scene = 'earthEnd', event = 'impact'}) => {
  const st = makeStyle(seed);
  const Comp = SCENES[scene] ?? SCENES.earthEnd;
  const lines = text.split('\n');
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <ThreeCanvas width={1280} height={720} camera={{fov: 50, position: [0, 0, 8]}}>
        <Comp frame={70} frames={120} style={st} event={event as any} variant={st.cam % 3} />
      </ThreeCanvas>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0) 100%)'}} />
      <div style={{position: 'absolute', left: 50, top: 60, right: 50, display: 'flex', flexDirection: 'column', gap: 6}}>
        {sub && (
          <div style={{alignSelf: 'flex-start', background: '#e11d48', color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 40, padding: '4px 22px', borderRadius: 14, border: '4px solid #fff', marginBottom: 12}}>{sub}</div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{fontFamily: FONT, fontWeight: 900, fontSize: Math.min(120, Math.floor(1150 / Math.max(1, [...l].length))), lineHeight: 1.15, color: i === lines.length - 1 ? '#ffe100' : '#fff', ...stroke(14)}}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
