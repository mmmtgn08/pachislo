import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {FPS, MoshimoProps} from './lib';
import sample from '../topics/oxygen.json';

// 台本(snake_case)を Composition の props(camelCase)に変換する。
// CLI の --props は defaultProps とマージされるため、defaultProps には snake_case を残さない。
const estimate = (p: any): MoshimoProps => {
  const {zero_label, status_label, youtube_title, description, tags, date, series, ...rest} = p;
  return {
    ...rest,
    zeroLabel: zero_label ?? p.zeroLabel ?? 'ゼロ',
    statusLabel: status_label ?? p.statusLabel ?? '',
    seed: zero_label !== undefined ? `${date}-${p.title}` : p.seed ?? `${date}-${p.title}`,
    badge: series ? `${series} #1` : p.badge ?? '',
    cta: p.cta ?? 'チャンネル登録で毎日「もしも」',
    scenes: p.scenes.map((s: any) => ({...s, frames: s.frames ?? Math.ceil((0.6 + s.text.length * 0.11) * FPS)})),
  };
};

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
