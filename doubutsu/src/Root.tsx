import React from 'react';
import {Composition} from 'remotion';
import {Main, Props} from './Main';
import sample from '../topics/tako.json';

export const FPS = 30;

// Studio でのプレビュー用(素材は public/clips に置いたものを使う)
const estimate = (p: any): Props => ({
  title: p.title,
  label: p.label ?? p.step_label ?? 'ヒミツ',
  total: p.total ?? Math.max(0, ...p.scenes.map((s: any) => s.step || 0)),
  ranking: p.ranking ?? p.format === 'ranking',
  cta: p.cta ?? 'チャンネル登録で毎日いきもの雑学',
  seed: p.seed ?? `${p.date}-${p.title}`,
  bgm: p.bgm,
  bgmVolume: p.bgmVolume,
  scenes: p.scenes.map((s: any, i: number) => ({
    text: s.text,
    telop: s.telop ?? '',
    step: typeof s.step === 'number' ? s.step : null,
    se: s.se ?? null,
    audio: s.audio ?? null,
    clip: s.clip ?? null,
    frames: s.frames ?? Math.ceil((0.6 + s.text.length * 0.11) * FPS),
  })),
});

export const Root: React.FC = () => (
  <Composition
    id="Doubutsu"
    component={Main as any}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={estimate(sample)}
    calculateMetadata={({props}) => {
      const p = estimate(props);
      return {durationInFrames: p.scenes.reduce((a, s) => a + s.frames, 0), props: p};
    }}
  />
);
