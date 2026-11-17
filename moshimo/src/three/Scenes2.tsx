// 追加シーン: 宇宙 / 空 / 海の中 / 部屋 / 動物
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Cam, Person, Stars} from './common';
import {Earth} from './Earth';
import {Affected, Outdoor, darkK, eventAt, freezeK, iced} from './events';
import {Ground, Realism, SunLight, Tree, rbox} from './models';
import type {SceneProps} from './Scenes';
import {ease, lerp, prog, rnd} from '../lib';

type V3 = [number, number, number];
const camPath = (variant: number, paths: [V3, V3, V3][], frame: number, frames: number) => {
  const [a, b, look] = paths[variant % paths.length];
  const t = ease(prog(frame, 0, frames));
  return {pos: [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as V3, look};
};

// ───────── 宇宙: 太陽・地球・月 ─────────
// event: vanish=月が消える / dark=太陽が暗くなる / freeze=地球が凍る / float=大気が流れ出す / none
export const Space: React.FC<SceneProps> = ({frame, frames, event = 'none', variant}) => {
  const at = eventAt(frames);
  const dk = event === 'dark' ? darkK(frame, at) : 0;
  const moonK = event === 'vanish' ? 1 - ease(prog(frame, at, at + 8)) : 1;
  const k = ease(prog(frame, at, at + frames * 0.4));
  const a = frame * 0.012 + variant;
  const moon: V3 = [Math.cos(a) * 3.8, Math.sin(a) * 0.6, Math.sin(a) * 3.8];
  const c = camPath(variant, [
    [[0, 2.5, 11], [0, 1.8, 9], [0, 0, 0]],
    [[6, 3, 8], [4.5, 2, 7], [0, 0, 0]],
    [[-5, -1, 9], [-3.5, 0, 8], [-1, 0, 0]],
  ], frame, frames);
  const craters = useMemo(() => new Array(14).fill(0).map((_, i) => {
    const u = rnd(`cr${i}a`) * 2 - 1, th = rnd(`cr${i}b`) * Math.PI * 2, r = Math.sqrt(1 - u * u);
    return {p: [r * Math.cos(th) * 0.42, u * 0.42, r * Math.sin(th) * 0.42] as V3, s: 0.04 + rnd(`cr${i}c`) * 0.07};
  }), []);
  const sunCol = new THREE.Color('#ffd166').lerp(new THREE.Color('#3a0d00'), dk);
  return (
    <>
      <color attach="background" args={['#01020a']} />
      <Cam pos={c.pos} look={c.look} />
      <Stars count={1800} />
      <ambientLight intensity={0.06 + 0.04 * (1 - dk)} />
      <directionalLight position={[-3.5, 5.5, -12]} intensity={3 * (1 - dk * 0.95)} color="#fff4e0" />
      <directionalLight position={[4, 2, 8]} intensity={0.5 * (1 - dk * 0.9)} color="#9db4ff" />
      {/* 太陽 */}
      <group position={[-3.8, 6.5, -14]}>
        <mesh>
          <sphereGeometry args={[2.2, 48, 32]} />
          <meshBasicMaterial color={sunCol} />
        </mesh>
        {[2.9, 4].map((r, i) => (
          <mesh key={r}>
            <sphereGeometry args={[r, 32, 24]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={(i ? 0.08 : 0.18) * (1 - dk)} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <Earth rotation={frame * 0.01} radius={1.6} ice={event === 'freeze' ? k : 0} strip={event === 'float' ? k : 0} lights={dk} burn={event === 'meteor' ? ease(prog(frame, at + 20, at + 60)) * 0.7 : 0} />
      {event === 'meteor' && (() => {
        const hit = at + 20;
        const p = Math.min(1, Math.max(0, (frame - at + 30) / 50));
        const pos = new THREE.Vector3(6, 4, 3).lerp(new THREE.Vector3(1.1, 0.7, 0.8), ease(p));
        const t = (frame - hit) / 30;
        return (
          <>
            {frame < hit && (
              <mesh position={pos.toArray() as V3}>
                <icosahedronGeometry args={[0.35, 1]} />
                <meshStandardMaterial color="#3b2a20" emissive="#ff6a1a" emissiveIntensity={1.4} />
              </mesh>
            )}
            {t >= 0 && t < 1.2 && (
              <mesh position={[1.1, 0.7, 0.8]} scale={0.4 + t * 6}>
                <sphereGeometry args={[0.5, 20, 14]} />
                <meshBasicMaterial color="#fff2c4" transparent opacity={1 - t / 1.2} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
            )}
          </>
        );
      })()}
      {/* 月 */}
      {moonK > 0.01 && (
        <group position={moon} scale={moonK}>
          <mesh>
            <sphereGeometry args={[0.43, 32, 24]} />
            <meshStandardMaterial color="#c9c9c9" roughness={0.95} />
          </mesh>
          {craters.map((cr, i) => (
            <mesh key={i} position={cr.p}>
              <sphereGeometry args={[cr.s, 10, 8]} />
              <meshStandardMaterial color="#8d8d8d" roughness={1} />
            </mesh>
          ))}
        </group>
      )}
      {event === 'vanish' && frame >= at && frame < at + 10 && (
        <mesh position={moon} scale={0.5 + (frame - at) * 0.25}>
          <sphereGeometry args={[0.5, 16, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={1 - (frame - at) / 10} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* 月の軌道 */}
      <mesh rotation={[Math.PI / 2 - 0.16, 0, 0]}>
        <torusGeometry args={[3.85, 0.008, 6, 128]} />
        <meshBasicMaterial color="#8aa4ff" transparent opacity={0.35 * moonK} />
      </mesh>
    </>
  );
};

// ───────── 空: 雲・鳥・飛行機 ─────────
const Bird: React.FC<{flap: number; color?: string}> = ({flap, color = '#2d2d2d'}) => (
  <group>
    <mesh scale={[1, 0.6, 0.6]}>
      <sphereGeometry args={[0.18, 12, 8]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[0, 0.02, s * 0.2]} rotation={[s * (0.2 + flap), 0, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    ))}
  </group>
);

const Cloud: React.FC<{seed: string; color: string; opacity: number}> = ({seed, color, opacity}) => {
  const puffs = useMemo(() => new Array(6).fill(0).map((_, i) => ({
    p: [(rnd(`${seed}x${i}`) - 0.5) * 3.2, (rnd(`${seed}y${i}`) - 0.3) * 0.8, (rnd(`${seed}z${i}`) - 0.5) * 1.4] as V3,
    r: 0.7 + rnd(`${seed}r${i}`) * 0.7,
  })), [seed]);
  return (
    <group>
      {puffs.map((p, i) => (
        <mesh key={i} position={p.p}>
          <sphereGeometry args={[p.r, 18, 14]} />
          <meshStandardMaterial color={color} roughness={1} transparent={opacity < 1} opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
};

// event: vanish=雲が消える / wind / dark / freeze / rain / none
export const SkyScene: React.FC<SceneProps> = ({frame, frames, style, event = 'none', variant}) => {
  const at = eventAt(frames);
  const cloudK = event === 'vanish' ? 1 - ease(prog(frame, at, at + 20)) : 1;
  const windy = event === 'wind' && frame > at;
  const cloudCol = event === 'rain' || event === 'dark' ? '#9aa1ab' : '#ffffff';
  const clouds = useMemo(() => new Array(9).fill(0).map((_, i) => ({x: -18 + i * 4.5 + rnd(`cx${i}`) * 2, y: 5 + rnd(`cy${i}`) * 4, z: -8 - rnd(`cz${i}`) * 10})), []);
  const c = camPath(variant, [
    [[0, 3, 10], [0, 3.6, 9], [0, 5, 0]],
    [[-4, 2, 9], [-2, 2.5, 8], [0, 6, -4]],
    [[3, 4, 11], [1.5, 4.5, 10], [0, 5.5, -2]],
  ], frame, frames);
  const planeX = -7 + frame * 0.045;
  return (
    <>
      <Outdoor style={style} frame={frame} at={at} event={event} fogNear={30} fogFar={90} />
      <Cam pos={c.pos} look={c.look} />
      <Ground color={style.ground} size={200} y={-1} />
      {new Array(6).fill(0).map((_, i) => (
        <group key={i} position={[-12 + i * 5, -1, -14 - (i % 2) * 4]}>
          <Tree color="#2f8f3a" seed={`sk${i}`} scale={1.4} />
        </group>
      ))}
      {clouds.map((cl, i) => {
        const drift = windy ? Math.pow((frame - at) / 30, 2) * 8 : frame * 0.01;
        return (
          <group key={i} position={[cl.x + drift, cl.y, cl.z]} scale={cloudK}>
            <Cloud seed={`cl${i}`} color={cloudCol} opacity={1} />
          </group>
        );
      })}
      {new Array(7).fill(0).map((_, i) => {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const bx = -5 + frame * 0.03 - row * 0.9 + (windy ? Math.pow((frame - at) / 30, 2) * 10 : 0);
        return (
          <group key={i} scale={2.2} position={[bx, 5.2 + row * 0.35 * (i ? 1 : 0) + Math.sin(frame * 0.1 + i) * 0.1, 1 + side * row * 0.7]} rotation={[0, 0, windy ? -(frame - at) * 0.05 : 0]}>
            <Bird flap={Math.sin(frame * 0.6 + i) * 0.7} />
          </group>
        );
      })}
      {/* 飛行機 */}
      <group position={[planeX, 8.5, -8]} rotation={[0, 0, 0.04]} scale={1.3}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.28, 2.6, 6, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh geometry={rbox(0.7, 0.06, 3.4, 0.03)}>
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh position={[-1.3, 0.35, 0]} geometry={rbox(0.5, 0.6, 0.06, 0.03)}>
          <meshStandardMaterial color="#2563eb" roughness={0.4} />
        </mesh>
      </group>
    </>
  );
};

// ───────── 海の中 ─────────
const Fish: React.FC<{color: string; swim: number}> = ({color, swim}) => (
  <group>
    <mesh scale={[1, 0.55, 0.35]}>
      <sphereGeometry args={[0.32, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
    </mesh>
    <mesh position={[-0.36, 0, 0]} rotation={[swim, 0, Math.PI / 2]}>
      <coneGeometry args={[0.16, 0.26, 3]} />
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
    <mesh position={[0.2, 0.05, 0.1]}>
      <sphereGeometry args={[0.035, 8, 6]} />
      <meshStandardMaterial color="#111" />
    </mesh>
  </group>
);

// event: none / dark=光が届かなくなる / freeze=海面が凍る / vanish=水がなくなる / float=泡が増える
export const Underwater: React.FC<SceneProps> = ({frame, frames, event = 'none', variant}) => {
  const at = eventAt(frames);
  const dk = event === 'dark' ? darkK(frame, at) : 0;
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  const vk = event === 'vanish' ? ease(prog(frame, at, at + 30)) : 0;
  const water = new THREE.Color('#0b4f86').lerp(new THREE.Color('#020611'), dk).lerp(new THREE.Color('#9fc7e8'), vk);
  const fish = useMemo(() => new Array(24).fill(0).map((_, i) => ({
    r: 2 + rnd(`fr${i}`) * 3, y: 0.8 + rnd(`fy${i}`) * 2.5, ph: rnd(`fp${i}`) * Math.PI * 2, sp: 0.01 + rnd(`fs${i}`) * 0.012,
    c: ['#f97316', '#facc15', '#38bdf8', '#f472b6', '#a3e635'][i % 5],
  })), []);
  const corals = useMemo(() => new Array(16).fill(0).map((_, i) => ({x: (rnd(`kx${i}`) - 0.5) * 12, z: -rnd(`kz${i}`) * 8, c: ['#fb7185', '#f97316', '#c084fc', '#fbbf24'][i % 4], h: 0.4 + rnd(`kh${i}`) * 0.8})), []);
  const c = camPath(variant, [
    [[0, 1.6, 8], [0, 1.8, 6.5], [0, 1.4, 0]],
    [[-5, 1, 6], [-3.5, 1.4, 5], [0, 1.5, -1]],
    [[0, 5, 5], [0, 4.5, 4.2], [0, 0.5, -1]],
  ], frame, frames);
  return (
    <>
      <color attach="background" args={['#' + water.getHexString()]} />
      <fog attach="fog" args={['#' + water.getHexString(), 4 + vk * 30, 18 + vk * 60]} />
      <Cam pos={c.pos} look={c.look} />
      <Realism envIntensity={0.25 * (1 - dk)} />
      <ambientLight intensity={0.35 * (1 - dk * 0.85)} color="#9fdcff" />
      <SunLight intensity={1.6 * (1 - dk * 0.95)} color="#cfefff" position={[3, 14, 4]} size={14} />
      <Ground color="#d8c49a" size={60} />
      {corals.map((k, i) => (
        <group key={i} position={[k.x, 0, k.z]}>
          {[0, 1, 2].map((j) => (
            <mesh key={j} position={[(j - 1) * 0.15, k.h / 2, 0]} rotation={[0, 0, (j - 1) * 0.35]}>
              <capsuleGeometry args={[0.07, k.h, 4, 10]} />
              <meshStandardMaterial color={k.c} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      {new Array(10).fill(0).map((_, i) => (
        <group key={i} position={[-5 + i * 1.1, 0, -2 - (i % 3)]}>
          {[0, 1, 2, 3].map((j) => (
            <mesh key={j} position={[Math.sin(frame * 0.05 + i + j * 0.6) * 0.12 * j, 0.3 + j * 0.5, 0]}>
              <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
              <meshStandardMaterial color="#2f9e44" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {fish.map((f, i) => {
        const ang = f.ph + frame * f.sp * (1 - fz * 0.8);
        const fallen = vk > 0 ? Math.min(f.y - 0.1, vk * f.y) : 0;
        return (
          <group key={i} position={[Math.cos(ang) * f.r, f.y - fallen, Math.sin(ang) * f.r - 2]} rotation={[vk > 0.9 ? Math.PI / 2 : 0, -ang - Math.PI / 2, 0]}>
            <Fish color={f.c} swim={Math.sin(frame * 0.5 + i) * 0.5} />
          </group>
        );
      })}
      {vk < 0.95 &&
        new Array(30).fill(0).map((_, i) => {
          const t = (frame * 0.012 * (1 + rnd(`ub${i}`)) + rnd(`uo${i}`)) % 1;
          return (
            <mesh key={i} position={[(rnd(`ux${i}`) - 0.5) * 10, t * 7, -rnd(`uz${i}`) * 6]} scale={0.05 + t * 0.06}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#e0f7ff" transparent opacity={0.6 * (1 - t)} />
            </mesh>
          );
        })}
      {/* 光の筋 */}
      {dk < 0.95 &&
        vk < 0.5 &&
        [0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-3 + i * 2, 4, -2]} rotation={[0, 0, 0.25]}>
            <coneGeometry args={[0.8, 9, 16, 1, true]} />
            <meshBasicMaterial color="#bfefff" transparent opacity={0.06 * (1 - dk)} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      {/* 凍った海面 */}
      {fz > 0 && (
        <mesh position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.85 * fz} side={THREE.DoubleSide} roughness={0.3} />
        </mesh>
      )}
    </>
  );
};

// ───────── 部屋 ─────────
// event: dark=停電 / float / freeze / cheer / none
export const Room: React.FC<SceneProps> = ({frame, frames, style, event = 'none', variant}) => {
  const at = eventAt(frames);
  const dk = event === 'dark' ? (frame >= at ? 1 : 0) : 0; // 停電は一瞬で
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  const woodTex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#b07a4a' : '#a46d3f';
      g.fillRect(0, i * 32, 256, 32);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, i * 32, 256, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }, []);
  const c = camPath(variant, [
    [[0, 2.4, 7], [0, 2.2, 5.8], [0, 1.2, 0]],
    [[3.5, 2, 5.5], [2.5, 1.9, 4.8], [-0.5, 1.2, -1]],
    [[-3, 3, 5.5], [-2.2, 2.8, 4.8], [0.5, 1, -1]],
  ], frame, frames);
  const wall = iced('#efe6d8', fz);
  const items: {id: string; p: V3; node: React.ReactNode}[] = [
    {id: 'sofa', p: [-1.6, 0, -1.4], node: (
      <group>
        <mesh position={[0, 0.35, 0]} geometry={rbox(2.2, 0.5, 0.9, 0.15)}><meshStandardMaterial color={iced('#4f6d8f', fz)} roughness={0.9} /></mesh>
        <mesh position={[0, 0.8, -0.38]} geometry={rbox(2.2, 0.6, 0.22, 0.1)}><meshStandardMaterial color={iced('#4f6d8f', fz)} roughness={0.9} /></mesh>
      </group>
    )},
    {id: 'tv', p: [1.6, 0, -2.2], node: (
      <group>
        <mesh position={[0, 0.3, 0]} geometry={rbox(1.6, 0.6, 0.45, 0.06)}><meshStandardMaterial color="#5b4636" roughness={0.7} /></mesh>
        <mesh position={[0, 1.15, 0]} geometry={rbox(1.5, 0.88, 0.07, 0.03)}><meshStandardMaterial color="#111" roughness={0.3} /></mesh>
        <mesh position={[0, 1.15, 0.04]}>
          <planeGeometry args={[1.38, 0.76]} />
          <meshStandardMaterial color={dk ? '#050505' : '#6fb6ff'} emissive={dk ? '#000' : '#4aa3ff'} emissiveIntensity={dk ? 0 : 1.2} />
        </mesh>
      </group>
    )},
    {id: 'table', p: [-0.3, 0, 0.2], node: (
      <group>
        <mesh position={[0, 0.42, 0]} geometry={rbox(1.1, 0.07, 0.6, 0.03)}><meshStandardMaterial color="#8b5e3c" roughness={0.6} /></mesh>
        {[[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.2, z]}><cylinderGeometry args={[0.03, 0.03, 0.4, 8]} /><meshStandardMaterial color="#6b4423" /></mesh>
        ))}
        <mesh position={[0.2, 0.52, 0]}><cylinderGeometry args={[0.06, 0.05, 0.13, 16]} /><meshStandardMaterial color="#f8fafc" roughness={0.3} /></mesh>
      </group>
    )},
    {id: 'fridge', p: [3.0, 0, -1.8], node: (
      <mesh position={[0, 0.95, 0]} geometry={rbox(0.8, 1.9, 0.7, 0.08)}><meshStandardMaterial color={iced('#e5e7eb', fz)} roughness={0.3} metalness={0.2} /></mesh>
    )},
  ];
  return (
    <>
      <color attach="background" args={[dk ? '#05060b' : '#cfe8ff']} />
      <Cam pos={c.pos} look={c.look} fov={55} />
      <Realism envIntensity={dk ? 0.08 : 0.25} />
      <ambientLight intensity={dk ? 0.12 : 0.3} color={dk ? '#8fa3d9' : '#ffffff'} />
      {/* 天井のライトと窓の光 */}
      {!dk && <pointLight position={[0, 3.1, 0]} intensity={14} distance={12} color="#fff1d6" castShadow shadow-mapSize={[512, 512]} />}
      <directionalLight position={[-6, 4, 4]} intensity={dk ? 0.7 : 1.2} color={dk ? '#7f95d6' : '#ffffff'} />
      {dk && <pointLight position={[1.6, 1.15, -1.6]} intensity={0} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 7]} />
        <meshStandardMaterial map={woodTex} color={iced('#ffffff', fz)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.7, -3]}><planeGeometry args={[9, 3.4]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      <mesh position={[-4.5, 1.7, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[7, 3.4]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      {/* 窓 */}
      <mesh position={[-4.48, 1.8, -0.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.8, 1.2]} />
        <meshBasicMaterial color={dk ? '#0b1030' : style.sky.top} />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.35, 0.2, 0.18, 24]} /><meshStandardMaterial color="#f5f5f4" emissive={dk ? '#000' : '#fff3d6'} emissiveIntensity={dk ? 0 : 1} /></mesh>
      {items.map((it) => (
        <Affected key={it.id} event={event === 'float' ? 'float' : undefined} frame={frame} at={at} id={it.id} position={it.p} power={0.25}>
          {it.node}
        </Affected>
      ))}
      <Affected event={event === 'float' ? 'float' : event === 'freeze' ? 'freeze' : undefined} frame={frame} at={at} id="person" position={[0.6, 0, 1.2]} power={0.3}>
        <Person color={style.people[0]} rotationY={-0.3} armUp={event === 'cheer' ? 0.8 : 0} bounce={event === 'cheer' ? Math.abs(Math.sin(frame * 0.25)) * 0.3 : 0} headShake={dk && frame < at + 30 ? Math.sin(frame * 0.6) * 0.2 : 0} />
      </Affected>
    </>
  );
};

// ───────── 動物 ─────────
type Species = 'dog' | 'cat' | 'rabbit';
export const Animal: React.FC<{species: Species; color: string; frame: number; alert?: number; jump?: number; shiver?: number}> = ({species, color, frame, alert = 0, jump = 0, shiver = 0}) => {
  const s = species === 'dog' ? 1 : species === 'cat' ? 0.8 : 0.65;
  const wag = Math.sin(frame * (species === 'dog' ? 0.8 : 0.2)) * 0.5;
  const mat = <meshStandardMaterial color={color} roughness={0.9} />;
  const dark = <meshStandardMaterial color="#1b130e" roughness={0.3} />;
  return (
    <group scale={s} position={[shiver ? Math.sin(frame * 3) * 0.02 : 0, jump, 0]}>
      {/* 体 */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.24, species === 'rabbit' ? 0.25 : 0.55, 6, 14]} />
        {mat}
      </mesh>
      {/* 脚 */}
      {[[0.3, 0.13], [0.3, -0.13], [-0.3, 0.13], [-0.3, -0.13]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * (species === 'rabbit' ? 0.6 : 1), 0.22, z]}>
          <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
          {mat}
        </mesh>
      ))}
      {/* 頭 */}
      <group position={[0.5 * (species === 'rabbit' ? 0.7 : 1), 0.85 + alert * 0.08, 0]} rotation={[0, 0, alert * 0.2]}>
        <mesh>
          <sphereGeometry args={[0.22, 20, 14]} />
          {mat}
        </mesh>
        {species === 'dog' && (
          <mesh position={[0.22, -0.06, 0]} scale={[1.6, 0.85, 0.95]}>
            <sphereGeometry args={[0.11, 14, 10]} />
            {mat}
          </mesh>
        )}
        <mesh position={[species === 'dog' ? 0.39 : 0.21, species === 'dog' ? -0.03 : -0.02, 0]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          {dark}
        </mesh>
        {[-1, 1].map((z) => (
          <group key={z}>
            <mesh position={[0.15, 0.06, z * 0.1]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              {dark}
            </mesh>
            {species === 'cat' && (
              <mesh position={[-0.02, 0.22, z * 0.11]} rotation={[z * 0.2, 0, 0]}>
                <coneGeometry args={[0.07, 0.16, 12]} />
                {mat}
              </mesh>
            )}
            {species === 'rabbit' && (
              <mesh position={[-0.04, 0.3 + alert * 0.05, z * 0.07]} rotation={[z * 0.1, 0, -0.1]}>
                <capsuleGeometry args={[0.045, 0.32, 4, 10]} />
                {mat}
              </mesh>
            )}
            {species === 'dog' && (
              <mesh position={[-0.02, 0.06 + alert * 0.08, z * 0.2]} rotation={[z * (0.9 - alert * 0.7), 0, 0.2]} scale={[0.55, 1.35, 0.3]}>
                <sphereGeometry args={[0.13, 12, 8]} />
                {mat}
              </mesh>
            )}
          </group>
        ))}
      </group>
      {/* しっぽ */}
      {species === 'rabbit' ? (
        <mesh position={[-0.32, 0.6, 0]}>
          <sphereGeometry args={[0.1, 12, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ) : (
        <mesh position={[-0.52, 0.72, 0]} rotation={[wag, 0, 0.9]}>
          <capsuleGeometry args={[0.045, 0.35, 4, 8]} />
          {mat}
        </mesh>
      )}
    </group>
  );
};

// event: none / ears=びっくり / cheer=ジャンプ / float / freeze / dark / wind / rain
export const Animals: React.FC<SceneProps> = ({frame, frames, style, event = 'none', variant}) => {
  const at = eventAt(frames);
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  const after = frame > at;
  const list: {sp: Species; c: string; p: V3; ry: number}[] = [
    {sp: 'dog', c: ['#c08552', '#e8c48a', '#8b5a2b'][Math.floor(rnd(`${style.seed}dg`) * 3)], p: [-0.6, 0, 0.3], ry: 0.5},
    {sp: 'cat', c: ['#f4a261', '#9ca3af', '#2b2b2b'][Math.floor(rnd(`${style.seed}ct`) * 3)], p: [1.2, 0, -0.4], ry: 2.4},
    {sp: 'rabbit', c: '#f8f8f8', p: [0.3, 0, 1.3], ry: 1.2},
  ];
  const c = camPath(variant, [
    [[0, 1.6, 5.5], [0, 1.4, 4.3], [0.2, 0.6, 0]],
    [[-3, 1.2, 4], [-2.2, 1.1, 3.4], [0.2, 0.6, 0]],
    [[2.5, 2.6, 4], [1.8, 2.2, 3.4], [0, 0.5, 0]],
  ], frame, frames);
  return (
    <>
      <Outdoor style={style} frame={frame} at={at} event={event} fogNear={14} fogFar={50} />
      <Cam pos={c.pos} look={c.look} />
      <Ground color={iced('#86c26a', fz)} size={80} circle />
      {new Array(6).fill(0).map((_, i) => {
        const a = Math.PI * (1.1 + (i / 5) * 0.8);
        return (
          <group key={i} position={[Math.cos(a) * 7, 0, Math.sin(a) * 5 - 3]}>
            <Tree color={iced('#2f8f3a', fz)} seed={`an${i}`} />
          </group>
        );
      })}
      {list.map((a, i) => (
        <Affected key={i} event={['float', 'wind', 'explode', 'tsunami', 'meteor'].includes(event) ? event : undefined} frame={frame} at={at} id={`an${i}`} position={a.p} rotation={[0, a.ry, 0]} power={0.35}>
          <Animal
            species={a.sp}
            color={iced(a.c, fz * 0.5)}
            frame={frame + i * 7}
            alert={event === 'ears' && after ? 1 : 0}
            jump={event === 'cheer' ? Math.abs(Math.sin(frame * 0.22 + i)) * 0.35 : event === 'ears' && after && frame < at + 8 ? 0.25 : 0}
            shiver={fz}
          />
        </Affected>
      ))}
    </>
  );
};
