import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {LongMain, LongProps, Thumbnail, longFrames} from './Long';
import {FPS, MoshimoProps} from './lib';
import sample from '../topics/oxygen.json';

// 台本(snake_case)を Composition の props(camelCase)に変換する。
// CLI の --props は defaultProps とマージされるため、defaultProps には snake_case を残さない。
const estimate = (p: any): MoshimoProps => {
  const {zero_label, status_label, youtube_title, description, tags, date, series, timer_duration, timer_decimals, timer_unit, timer_label, ...rest} = p;
  return {
    ...rest,
    zeroLabel: zero_label ?? p.zeroLabel ?? 'ゼロ',
    statusLabel: status_label ?? p.statusLabel ?? '',
    seed: zero_label !== undefined ? `${date}-${p.title}` : p.seed ?? `${date}-${p.title}`,
    badge: series ? `${series} #1` : p.badge ?? '',
    cta: p.cta ?? 'チャンネル登録で毎日「もしも」',
    timer:
      timer_duration === 0
        ? null
        : timer_duration !== undefined || p.timer === undefined
          ? {duration: timer_duration ?? 5, decimals: timer_decimals ?? 1, unit: timer_unit ?? '秒', label: timer_label ?? '経過'}
          : p.timer,
    scenes: p.scenes.map((s: any) => ({...s, frames: s.frames ?? Math.ceil((0.6 + s.text.length * 0.11) * FPS)})),
  };
};

// 長尺動画のプレビュー用サンプル(本番は render.mjs が props を渡す)
const longSample: LongProps = {
  title: 'もしも地球シリーズ\n深掘りスペシャル',
  seed: 'long-sample',
  intro: {text: '', frames: 150},
  outro: {text: '', frames: 120},
  cardFrames: 75,
  chapters: [estimate(sample)].map((c) => ({...c, chapterTitle: '酸素が消えたら', badge: '第1章', cta: ''})),
};

export const Root: React.FC = () => (
  <>
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
  <Composition
    id="MoshimoLong"
    component={LongMain as any}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={300}
    defaultProps={longSample}
    calculateMetadata={({props}) => ({durationInFrames: longFrames(props as LongProps)})}
  />
  <Composition
    id="Thumbnail"
    component={Thumbnail as any}
    fps={FPS}
    width={1280}
    height={720}
    durationInFrames={1}
    defaultProps={{text: 'もしも月が\n消えたら', sub: '深掘りスペシャル', seed: 'thumb'}}
  />
  </>
);
