import {interpolate, random} from 'remotion';

export const FPS = 30;

/** 0→1 にクランプした補間 */
export const prog = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const ease = (t: number) => t * t * (3 - 2 * t);

/** 決定的な乱数(同じ seed なら毎フレーム同じ値) */
export const rnd = (seed: string | number) => random(seed);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** ポップイン用スケール(0→1.15→1) */
export const pop = (frame: number, start = 0, dur = 8) => {
  const t = (frame - start) / dur;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.6 ? lerp(0.3, 1.15, t / 0.6) : lerp(1.15, 1, (t - 0.6) / 0.4);
};

export type SceneType = 'earthIntro' | 'city' | 'fire' | 'person' | 'personOk' | 'ocean' | 'crumble' | 'earthEnd';

export type Scene = {
  type: SceneType;
  text: string;
  telop: string;
  frames: number;
  audio?: string | null;
  se?: string | null;
};

export type MoshimoProps = {
  title: string;
  badge: string;
  cta: string;
  scenes: Scene[];
};
