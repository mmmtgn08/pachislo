import {interpolate, random} from 'remotion';

export const FPS = 30;

/** 0→1 にクランプした補間 */
export const prog = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const ease = (t: number) => t * t * (3 - 2 * t);

/** 決定的な乱数(同じ seed なら毎フレーム同じ値) */
export const rnd = (seed: string | number) => random(seed);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const pick = <T,>(arr: T[], seed: string) => arr[Math.floor(rnd(seed) * arr.length) % arr.length];

/** ポップイン用スケール(0→1.15→1) */
export const pop = (frame: number, start = 0, dur = 8) => {
  const t = (frame - start) / dur;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.6 ? lerp(0.3, 1.15, t / 0.6) : lerp(1.15, 1, (t - 0.6) / 0.4);
};

// ───────── 台本の型 ─────────
export const SCENE_TYPES = ['earthIntro', 'city', 'fire', 'park', 'ocean', 'crumble', 'earthEnd'] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

/** シーン内で起きる出来事 */
export const EVENTS = ['none', 'stall', 'float', 'dark', 'freeze', 'wind', 'vanish', 'ears', 'cheer', 'out', 'grow'] as const;
export type SceneEvent = (typeof EVENTS)[number];

/** 地球のエンディング */
export const ENDINGS = ['crumble', 'ice', 'dark', 'fine', 'float'] as const;

export type Scene = {
  type: SceneType;
  event?: SceneEvent | (typeof ENDINGS)[number];
  text: string;
  telop: string;
  frames: number;
  audio?: string | null;
  se?: string | null;
  countdown?: boolean;
};

export type MoshimoProps = {
  title: string;
  badge: string;
  cta: string;
  zeroLabel: string; // カウントダウン後の表示 例: 「酸素 0%」
  statusLabel: string; // 右上バッジ 例: 「O₂ 0%」
  seed: string;
  bgm?: string; // public/ 内の BGM ファイル
  bgmVolume?: number;
  scenes: Scene[];
};

// ───────── 見た目のバリエーション ─────────
export type TimeOfDay = 'day' | 'sunset' | 'night';

export type Style = {
  seed: string;
  tod: TimeOfDay;
  sky: {top: string; bottom: string};
  sun: {color: string; intensity: number; ambient: number};
  cam: number;
  transition: 'flash' | 'zoom' | 'slide' | 'dip';
  title: {fg: string; stroke: string; box: string; border: string};
  telop: {fg: string; stroke: string; emph: string};
  people: string[];
  buildings: string[];
  cars: string[];
  ground: string;
};

const SKIES: Record<TimeOfDay, Style['sky']> = {
  day: {top: '#3d9bff', bottom: '#d8efff'},
  sunset: {top: '#ff6f61', bottom: '#ffd1a1'},
  night: {top: '#070b1f', bottom: '#27365f'},
};
const SUNS: Record<TimeOfDay, Style['sun']> = {
  day: {color: '#ffffff', intensity: 2.3, ambient: 0.8},
  sunset: {color: '#ffb27a', intensity: 1.9, ambient: 0.6},
  night: {color: '#9db4ff', intensity: 0.8, ambient: 0.4},
};
const TITLE_STYLES = [
  {fg: '#ffe100', stroke: '#9b0000', box: 'rgba(0,0,0,0.72)', border: '#ffd400'},
  {fg: '#ffffff', stroke: '#7a0010', box: 'rgba(200,16,46,0.88)', border: '#ffffff'},
  {fg: '#7df9ff', stroke: '#001a4d', box: 'rgba(5,20,60,0.85)', border: '#7df9ff'},
  {fg: '#111111', stroke: '#ffffff', box: 'rgba(255,214,0,0.92)', border: '#111111'},
];
const TELOP_STYLES = [
  {fg: '#ffffff', stroke: '#000000', emph: '#ff3b3b'},
  {fg: '#ffe600', stroke: '#000000', emph: '#ff4fd8'},
  {fg: '#ffffff', stroke: '#0a3d91', emph: '#ffe600'},
  {fg: '#ffffff', stroke: '#b3001b', emph: '#00e5ff'},
];
const PEOPLE = [
  ['#3b82f6', '#f97316', '#a855f7', '#ef4444', '#22c55e'],
  ['#0ea5e9', '#f43f5e', '#eab308', '#14b8a6', '#8b5cf6'],
  ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#64748b'],
];
const BUILDINGS = [
  ['#e2e8f0', '#cbd5e1', '#fde68a', '#bfdbfe', '#fecaca'],
  ['#f5f5f4', '#d6d3d1', '#a8a29e', '#fcd34d', '#93c5fd'],
  ['#fef3c7', '#fde2e4', '#e0f2fe', '#dcfce7', '#ede9fe'],
];
const CARS = [
  ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#f8fafc'],
  ['#111827', '#f8fafc', '#dc2626', '#2563eb', '#facc15', '#9ca3af'],
];
const GROUNDS = ['#8fbf6a', '#7fb35a', '#9cc77a'];

export const makeStyle = (seed: string, forceTod?: TimeOfDay): Style => {
  const tod = forceTod ?? pick<TimeOfDay>(['day', 'day', 'sunset', 'night'], `${seed}-tod`);
  return {
    seed,
    tod,
    sky: SKIES[tod],
    sun: SUNS[tod],
    cam: Math.floor(rnd(`${seed}-cam`) * 3),
    transition: pick(['flash', 'zoom', 'slide', 'dip'] as const, `${seed}-tr`),
    title: pick(TITLE_STYLES, `${seed}-title`),
    telop: pick(TELOP_STYLES, `${seed}-telop`),
    people: pick(PEOPLE, `${seed}-ppl`),
    buildings: pick(BUILDINGS, `${seed}-bld`),
    cars: pick(CARS, `${seed}-car`),
    ground: pick(GROUNDS, `${seed}-gnd`),
  };
};
