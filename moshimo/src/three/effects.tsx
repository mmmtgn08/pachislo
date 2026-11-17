// 迫力のある演出: 隕石・大爆発・巨大津波・炎上
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {ease, prog, rnd} from '../lib';

type V3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);
const add = {transparent: true, blending: THREE.AdditiveBlending, depthWrite: false} as const;

/** 爆発や着弾の中心(場面ごとに共通の位置) */
export const BLAST_CENTER: V3 = [0, 0, -9];

// ───────── 着弾エフェクト(閃光・衝撃波・土煙) ─────────
const Impact: React.FC<{t: number; pos: V3; size?: number}> = ({t, pos, size = 1}) => {
  if (t < 0 || t > 2.5) return null;
  const flash = Math.max(0, 1 - t / 0.25);
  const ring = ease(Math.min(1, t / 1.2));
  return (
    <group position={pos}>
      {flash > 0 && (
        <mesh scale={(1 + t * 10) * size}>
          <sphereGeometry args={[0.6, 16, 12]} />
          <meshBasicMaterial color="#fff2c4" opacity={flash} {...add} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={(0.5 + ring * 9) * size}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial color="#ffd7a1" opacity={0.7 * (1 - ring)} side={THREE.DoubleSide} {...add} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const k = Math.min(1, t / 1.6);
        return (
          <mesh key={i} position={[Math.cos(i * 1.3) * k * 2 * size, (0.5 + k * 2.5 + i * 0.3) * size, Math.sin(i * 1.3) * k * 2 * size]} scale={(0.6 + k * 2.2) * size}>
            <sphereGeometry args={[0.6, 14, 10]} />
            <meshStandardMaterial color="#6b625a" transparent opacity={0.75 * (1 - Math.max(0, t - 1.2) / 1.3)} roughness={1} depthWrite={false} />
          </mesh>
        );
      })}
      {flash > 0 && <pointLight color="#ffb05a" intensity={200 * flash * size} distance={40} />}
    </group>
  );
};

// ───────── 隕石群 ─────────
export const MeteorShower: React.FC<{frame: number; at: number; count?: number; spread?: number}> = ({frame, at, count = 22, spread = 1}) => {
  const ms = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => {
        const target = new THREE.Vector3((rnd(`mt${i}x`) - 0.5) * 40 * spread, 0, 4 - rnd(`mt${i}z`) * 30 * spread);
        const start = target.clone().add(new THREE.Vector3(-8 - rnd(`ms${i}`) * 5, 18, -4));
        const dir = target.clone().sub(start).normalize();
        return {target, start, delay: i * 3 + rnd(`md${i}`) * 3, dur: 24 + rnd(`mu${i}`) * 8, size: 0.9 + rnd(`mz${i}`) * 1.1, q: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().negate())};
      }),
    [count, spread]
  );
  return (
    <>
      {ms.map((m, i) => {
        const lt = frame - at - m.delay;
        if (lt < 0) return null;
        const p = lt / m.dur;
        if (p < 1) {
          const pos = m.start.clone().lerp(m.target, p);
          return (
            <group key={i} position={pos.toArray() as V3}>
              <mesh scale={m.size}>
                <icosahedronGeometry args={[0.7, 1]} />
                <meshStandardMaterial color="#3b2a20" emissive="#ff6a1a" emissiveIntensity={1.5} roughness={0.9} />
              </mesh>
              <group quaternion={m.q} scale={m.size}>
                <mesh position={[0, 4.2, 0]}>
                  <coneGeometry args={[0.8, 8.4, 16, 1, true]} />
                  <meshBasicMaterial color="#ffb347" opacity={0.75} side={THREE.DoubleSide} {...add} />
                </mesh>
              </group>
              <pointLight color="#ff8a3a" intensity={30 * m.size} distance={18} />
            </group>
          );
        }
        return <Impact key={i} t={(lt - m.dur) / 30} pos={m.target.toArray() as V3} size={m.size * 1.4} />;
      })}
    </>
  );
};

// ───────── 大爆発 ─────────
export const Explosion: React.FC<{frame: number; at: number; pos?: V3; size?: number}> = ({frame, at, pos = BLAST_CENTER, size = 1}) => {
  const t = (frame - at) / 30;
  if (t < 0) return null;
  const grow = ease(Math.min(1, t / 0.6));
  const cool = Math.min(1, Math.max(0, (t - 0.3) / 1.5));
  const core = new THREE.Color('#fff7d6').lerp(new THREE.Color('#ff5a1a'), cool);
  const ring = Math.min(1, t / 1.0);
  return (
    <group position={pos} scale={size}>
      <mesh position={[0, 2 + grow * 3 + cool * 4, 0]} scale={1 + grow * 6 + cool * 2}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color={core} opacity={0.95 - cool * 0.35} {...add} />
      </mesh>
      {/* きのこ雲の柱と傘 */}
      <mesh position={[0, 1 + cool * 4, 0]} scale={[1 + grow * 1.5, 1 + cool * 5, 1 + grow * 1.5]}>
        <cylinderGeometry args={[0.8, 1.4, 2, 24]} />
        <meshStandardMaterial color="#7a5a48" transparent opacity={0.85 * cool} roughness={1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 4 + grow * 3 + cool * 6, 0]} scale={[2 + grow * 6, 1 + grow * 2.5, 2 + grow * 6]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial color="#5b4a42" transparent opacity={0.8 * cool} roughness={1} depthWrite={false} />
      </mesh>
      {/* 衝撃波 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} scale={1 + ring * 40}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#ffe0b0" opacity={0.8 * (1 - ring)} side={THREE.DoubleSide} {...add} />
      </mesh>
      <pointLight position={[0, 5, 0]} color="#ffb060" intensity={600 * Math.max(0, 1 - t / 2)} distance={80} />
    </group>
  );
};

/** 爆心からの吹き飛び(Affected 用) */
export const blastFx = (frame: number, at: number, pos: V3, key: string, power = 1) => {
  const t = Math.max(0, frame - at - 4) / 30;
  if (t <= 0) return {dx: 0, dy: 0, dz: 0, rx: 0, rz: 0};
  const v = new THREE.Vector3(pos[0] - BLAST_CENTER[0], 0, pos[2] - BLAST_CENTER[2]);
  const dist = Math.max(2, v.length());
  v.normalize();
  const k = (power * 30) / dist;
  const r = rnd(`bl${key}`);
  return {dx: v.x * k * t * 3, dy: Math.max(0, k * t * (1.5 - t)) * 1.2, dz: v.z * k * t * 3, rx: t * k * (r - 0.5) * 3, rz: t * k * (rnd(`blz${key}`) - 0.5) * 3};
};

// ───────── 巨大津波 ─────────
export const tsunamiFront = (frame: number, at: number) => -30 + Math.max(0, frame - at) * 0.42;

export const Tsunami: React.FC<{frame: number; at: number}> = ({frame, at}) => {
  const {geo, base} = useMemo(() => {
    const g = new THREE.PlaneGeometry(90, 1, 90, 12);
    return {geo: g, base: Float32Array.from(g.attributes.position.array as Float32Array)};
  }, []);
  if (frame < at) return null;
  const z = tsunamiFront(frame, at);
  const h = 5 + ease(prog(frame, at, at + 45)) * 12;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const v = base[i * 3 + 1] + 0.5; // 0..1 (下→上)
    // 波の断面: 前に巻き込む形
    const curl = Math.pow(v, 3) * 2.2;
    pos.setXYZ(i, x, v * h + Math.sin(x * 0.3 + frame * 0.2) * 0.3 * v, curl + Math.sin(x * 0.15 + frame * 0.1) * 0.6);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return (
    <group position={[0, -0.2, z]}>
      <mesh geometry={geo} frustumCulled={false}>
        <meshStandardMaterial color="#2f86d6" roughness={0.15} metalness={0.1} side={THREE.DoubleSide} transparent opacity={0.95} fog={false} />
      </mesh>
      {/* 波の後ろの水のかたまり */}
      <mesh position={[0, h * 0.4, -6]}>
        <boxGeometry args={[90, h * 0.8, 12]} />
        <meshStandardMaterial color="#2470b8" roughness={0.3} fog={false} />
      </mesh>
      {/* 白い波頭 */}
      {new Array(30).fill(0).map((_, i) => (
        <mesh key={i} position={[-42 + i * 2.9, h + Math.sin(frame * 0.3 + i) * 0.3, 2.2]} scale={0.8 + rnd(`fo${i}`) * 0.8}>
          <sphereGeometry args={[0.8, 12, 8]} />
          <meshStandardMaterial color="#f1f8ff" roughness={0.6} fog={false} />
        </mesh>
      ))}
    </group>
  );
};

// ───────── 炎上 ─────────
export const Fires: React.FC<{frame: number; at: number; count?: number}> = ({frame, at, count = 14}) => {
  const spots = useMemo(() => new Array(count).fill(0).map((_, i) => ({x: (rnd(`fx${i}`) - 0.5) * 34, z: -2 - rnd(`fz${i}`) * 20, s: 0.8 + rnd(`fs${i}`) * 1.4, d: rnd(`fd${i}`) * 25})), [count]);
  return (
    <>
      {spots.map((sp, i) => {
        const k = ease(prog(frame, at + sp.d, at + sp.d + 20));
        if (k <= 0) return null;
        const fl = 0.85 + 0.15 * Math.sin(frame * 1.3 + i);
        return (
          <group key={i} position={[sp.x, 0, sp.z]} scale={sp.s * k}>
            {[0, 1, 2, 3, 4].map((j) => {
              const t = (frame * 0.05 + j / 5 + i * 0.13) % 1;
              return (
                <mesh key={j} position={[Math.sin(j * 2 + i) * 0.4 * (1 - t), 0.3 + t * 2.4, Math.cos(j * 2 + i) * 0.4 * (1 - t)]} scale={(1 - t) * 0.9 * fl}>
                  <icosahedronGeometry args={[1, 1]} />
                  <meshBasicMaterial color={new THREE.Color('#ffd23a').lerp(new THREE.Color('#ff3b1a'), t)} opacity={0.85} {...add} />
                </mesh>
              );
            })}
            {[0, 1, 2].map((j) => {
              const t = (frame * 0.015 + j / 3 + i * 0.07) % 1;
              return (
                <mesh key={`s${j}`} position={[Math.sin(t * 4 + i) * 0.6, 2.5 + t * 8, 0]} scale={0.8 + t * 2.2}>
                  <sphereGeometry args={[1, 12, 10]} />
                  <meshStandardMaterial color="#3f3a36" transparent opacity={0.55 * (1 - t)} roughness={1} depthWrite={false} />
                </mesh>
              );
            })}
            <pointLight position={[0, 1.5, 0]} color="#ff7a2a" intensity={25 * fl} distance={12} />
          </group>
        );
      })}
    </>
  );
};
