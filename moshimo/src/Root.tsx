import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {FPS, MoshimoProps} from './lib';
import sample from '../topics/oxygen.json';

// スタジオでのプレビュー用: 文字数から長さを見積もる
const estimate = (p: any): MoshimoProps => ({
  ...p,
  // CLI の --props はデフォルト値とマージされるので、台本(snake_case)の値を優先する
  zeroLabel: p.zero_label ?? p.zeroLabel ?? 'ゼロ',
  statusLabel: p.status_label ?? p.statusLabel ?? '',
  seed: p.zero_label !== undefined || p.seed === undefined ? `${p.date}-${p.title}` : p.seed,
  badge: p.series ? `${p.series} #1` : p.badge ?? '',
  cta: p.cta ?? 'チャンネル登録で毎日「もしも」',
  scenes: p.scenes.map((s: any) => ({...s, frames: s.frames ?? Math.ceil((0.6 + s.text.length * 0.11) * FPS)})),
});

export const Root: React.FC = () => (
  <Composition
    id="Moshimo"
    component={Main as any}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={estimate(sample)}
    calculateMetadata={({props}) => {
      const p = estimate(props);
      return {durationInFrames: p.scenes.reduce((a: number, s: any) => a + s.frames, 0), props: p};
    }}
  />
);
