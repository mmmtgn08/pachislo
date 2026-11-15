import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {FPS, MoshimoProps} from './lib';
import sample from '../topics/oxygen.json';

// スタジオでのプレビュー用: 文字数から長さを見積もる
const estimate = (p: any): MoshimoProps => ({
  ...p,
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
