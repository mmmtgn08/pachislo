import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Sky, Stars} from './common';
import {Style, ease, prog, rnd} from '../lib';

/** 出来事が起きるシーン内フレーム */
export const eventAt = (frames: number) => Math.round(frames * 0.38);

const sec = (frame: number, at: number) => Math.max(0, frame - at) / 30;

/** 無重力: 上に浮いて回転 */
export const floatFx = (frame: number, at: number, key: string, power = 1) => {
  const t = sec(frame, at);
  const r = rnd(`fl-${key}`);
  return {dy: Math.pow(t, 1.6) * (1.2 + r * 2.2) * power, rx: t * (r - 0.5) * 2.5 * power, rz: t * (rnd(`flz-${key}`) - 0.5) * 2.5 * power};
};

/** 暴風: 横に吹き飛ばされて転がる */
export const windFx = (frame: number, at: number, key: string, power = 1) => {
  const t = sec(frame, at);
  const r = rnd(`wd-${key}`);
  return {dx: t * t * (5 + r * 6) * power, dy: Math.sin(t * 6 + r * 9) * 0.2 * t, rz: -t * (1 + r * 3) * power};
};

export const freezeK = (frame: number, at: number) => ease(prog(frame, at, at + 36));
export const darkK = (frame: number, at: number) => ease(prog(frame, at, at + 30));

const ICE = new THREE.Color('#e6f6ff');
/** 凍結に応じて色を白っぽい氷色に寄せる */
export const iced = (color: string, k: number) => (k <= 0 ? color : '#' + new THREE.Color(color).lerp(ICE, k * 0.85).getHexString());

const mix = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

/** 屋外の空・光・霧・特殊効果をまとめて描く */
export const Outdoor: React.FC<{style: Style; frame: number; at: number; event?: string; fogNear?: number; fogFar?: number}> = ({
  style,
  frame,
  at,
  event,
  fogNear = 25,
  fogFar = 75,
}) => {
  const dk = event === 'dark' ? darkK(frame, at) : 0;
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  let top = style.sky.top, bottom = style.sky.bottom;
  if (dk > 0) {
    top = mix(top, '#000000', dk);
    bottom = mix(bottom, '#05060d', dk);
  }
  if (fz > 0) {
    top = mix(top, '#a9c7dd', fz * 0.7);
    bottom = mix(bottom, '#f2f8fc', fz * 0.7);
  }
  const night = style.tod === 'night' || dk > 0.5;
  const sunI = style.sun.intensity * (1 - dk * 0.92);
  const amb = style.sun.ambient * (1 - dk * 0.75);
  return (
    <>
      <Sky top={top} bottom={bottom} />
      <fog attach="fog" args={[bottom, fogNear, fogFar]} />
      <ambientLight intensity={amb} />
      <directionalLight position={[10, 15, 8]} color={style.sun.color} intensity={sunI} />
      {(style.tod === 'night' || dk > 0) && <Stars count={900} radius={100} />}
      {night && <hemisphereLight args={['#5b6fa8', '#1a1f33', 0.4]} />}
      {fz > 0 && <Snow frame={frame} k={fz} />}
      {event === 'wind' && <WindStreaks frame={frame} at={at} />}
    </>
  );
};

const Snow: React.FC<{frame: number; k: number}> = ({frame, k}) => {
  const flakes = useMemo(() => new Array(140).fill(0).map((_, i) => ({x: (rnd(`sx${i}`) - 0.5) * 40, z: (rnd(`sz${i}`) - 0.5) * 30, o: rnd(`so${i}`), s: 0.5 + rnd(`ss${i}`)})), []);
  return (
    <>
      {flakes.map((f, i) => {
        const y = 14 - ((frame * 0.05 * f.s + f.o * 14) % 14);
        return (
          <mesh key={i} position={[f.x + Math.sin(frame * 0.05 + i) * 0.3, y, f.z]} scale={0.06 + f.s * 0.04}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9 * k} />
          </mesh>
        );
      })}
    </>
  );
};

const WindStreaks: React.FC<{frame: number; at: number}> = ({frame, at}) => {
  const k = prog(frame, at, at + 10);
  if (k <= 0) return null;
  return (
    <>
      {new Array(40).fill(0).map((_, i) => {
        const y = 0.5 + rnd(`wy${i}`) * 8;
        const z = (rnd(`wz${i}`) - 0.5) * 20;
        const x = ((frame * 1.6 + rnd(`wx${i}`) * 60) % 60) - 30;
        return (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[3 + rnd(`wl${i}`) * 4, 0.04, 0.04]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.55 * k} />
          </mesh>
        );
      })}
    </>
  );
};

/** 出来事に応じて物体を動かすラッパー */
export const Affected: React.FC<{
  event?: string;
  frame: number;
  at: number;
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  power?: number;
  children: React.ReactNode;
}> = ({event, frame, at, id, position, rotation = [0, 0, 0], power = 1, children}) => {
  let [x, y, z] = position;
  let [rx, ry, rz] = rotation;
  if (event === 'float') {
    const f = floatFx(frame, at, id, power);
    y += f.dy;
    rx += f.rx;
    rz += f.rz;
  } else if (event === 'wind') {
    const w = windFx(frame, at, id, power);
    x += w.dx;
    y += Math.abs(w.dy);
    rz += w.rz;
  } else if (event === 'freeze') {
    x += Math.sin(frame * 2.7 + id.length) * 0.02 * freezeK(frame, at);
  }
  return (
    <group position={[x, y, z]} rotation={[rx, ry, rz]}>
      {children}
    </group>
  );
};
