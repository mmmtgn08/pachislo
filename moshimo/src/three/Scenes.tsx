import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Cam, Person, Sky, Stars} from './common';
import {Earth} from './Earth';
import {ease, lerp, prog, rnd} from '../lib';

type P = {frame: number; frames: number};

// ───────── 宇宙から地球 ─────────
export const EarthIntro: React.FC<P> = ({frame, frames}) => {
  const z = lerp(9, 6.2, ease(prog(frame, 0, frames)));
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Cam pos={[0, 0.4, z]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 2, 5]} intensity={2.6} />
      <Stars />
      <Earth rotation={frame * 0.006} />
    </>
  );
};

export const EarthEnd: React.FC<P> = ({frame, frames}) => {
  const k = ease(prog(frame, 10, frames * 0.75));
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Cam pos={[0, 0.6, lerp(7, 12, k)]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 2, 5]} intensity={2.4} />
      <Stars />
      <Earth rotation={0.8 + frame * 0.01} crumble={k} atmosphere={1 - k} clouds={1 - k} />
    </>
  );
};

// ───────── 街: 車が一斉に止まる ─────────
const CAR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#f8fafc'];

const Car: React.FC<{x: number; z: number; dir: number; color: string; smoke: number}> = ({x, z, dir, color, smoke}) => (
  <group position={[x, 0, z]} rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
    <mesh position={[0, 0.35, 0]}>
      <boxGeometry args={[1.6, 0.4, 0.8]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
    <mesh position={[-0.1, 0.7, 0]}>
      <boxGeometry args={[0.9, 0.35, 0.7]} />
      <meshStandardMaterial color="#cbd5e1" flatShading />
    </mesh>
    {[-0.5, 0.5].map((wx) =>
      [-0.4, 0.4].map((wz) => (
        <mesh key={`${wx}${wz}`} position={[wx, 0.15, wz]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.1, 10]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))
    )}
    {smoke > 0 && (
      <mesh position={[-1.0, 0.4 + smoke * 0.6, 0]} scale={0.2 + smoke * 0.5}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#9ca3af" transparent opacity={0.7 * (1 - smoke)} flatShading />
      </mesh>
    )}
  </group>
);

export const City: React.FC<P> = ({frame, frames}) => {
  const stopAt = Math.round(frames * 0.42);
  const buildings = useMemo(
    () =>
      new Array(36).fill(0).map((_, i) => {
        const side = i % 2 ? 1 : -1;
        const row = Math.floor(i / 2);
        return {
          x: -26 + row * 3 + rnd(`bx${i}`) * 0.6,
          z: side * (5 + rnd(`bz${i}`) * 3),
          h: side > 0 ? 1.2 + rnd(`bh${i}`) * 1.5 : 3 + rnd(`bh${i}`) * 8,
          w: 1.8 + rnd(`bw${i}`) * 0.8,
          c: ['#e2e8f0', '#cbd5e1', '#fde68a', '#bfdbfe', '#fecaca'][Math.floor(rnd(`bc${i}`) * 5)],
        };
      }),
    []
  );
  const cars = useMemo(
    () =>
      new Array(14).fill(0).map((_, i) => ({
        lane: i % 2 ? 1.2 : -1.2,
        dir: i % 2 ? -1 : 1,
        off: rnd(`co${i}`) * 50,
        speed: 0.25 + rnd(`cs${i}`) * 0.12,
        color: CAR_COLORS[i % CAR_COLORS.length],
      })),
    []
  );
  // 停止までの走行距離(停止後は減速して止まる)
  const dist = (f: number, v: number) => {
    if (f <= stopAt) return f * v;
    const dec = Math.min(f - stopAt, 12);
    return stopAt * v + v * (dec - (dec * dec) / 24);
  };
  const camX = lerp(-6, 2, ease(prog(frame, 0, frames)));
  return (
    <>
      <Sky top="#4aa3ff" bottom="#d6ecff" />
      <fog attach="fog" args={['#d6ecff', 25, 70]} />
      <Cam pos={[camX, 11, 17]} look={[camX + 4, 0.5, -1]} fov={50} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 15, 8]} intensity={2.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#8fbf6a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 5]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      {new Array(40).fill(0).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-60 + i * 3, 0.01, 0]}>
          <planeGeometry args={[1.2, 0.15]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial color={b.c} flatShading />
        </mesh>
      ))}
      {cars.map((c, i) => {
        const d = dist(frame, c.speed);
        const x = ((((c.off + d * c.dir) % 50) + 50) % 50) - 25;
        const smoke = frame > stopAt ? prog(frame, stopAt, stopAt + 25) : 0;
        return <Car key={i} x={x} z={c.lane} dir={c.dir} color={c.color} smoke={smoke} />;
      })}
    </>
  );
};

// ───────── 焚き火が消える ─────────
export const Fire: React.FC<P> = ({frame, frames}) => {
  const outAt = Math.round(frames * 0.35);
  const fire = 1 - prog(frame, outAt, outAt + 8);
  const flick = 0.85 + 0.15 * Math.sin(frame * 1.7) * Math.sin(frame * 0.9);
  const parts = useMemo(
    () => new Array(46).fill(0).map((_, i) => ({a: rnd(`fa${i}`) * Math.PI * 2, r: rnd(`fr${i}`) * 0.45, o: rnd(`fo${i}`), s: 0.6 + rnd(`fs${i}`) * 0.6})),
    []
  );
  return (
    <>
      <color attach="background" args={['#0b1026']} />
      <fog attach="fog" args={['#0b1026', 8, 30]} />
      <Cam pos={[0, 2.4 + frame * 0.002, lerp(6.5, 5, prog(frame, 0, frames))]} look={[0, 1, 0]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, 6, 5]} color="#9db4ff" intensity={0.9} />
      <Stars count={600} radius={40} />
      <pointLight position={[0, 1.2, 0]} color="#ff9a3c" intensity={40 * fire * flick} distance={14} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[20, 32]} />
        <meshStandardMaterial color="#2d3a2a" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.15, 0]} rotation={[0, (i * Math.PI) / 4, Math.PI / 2.3]}>
          <cylinderGeometry args={[0.12, 0.14, 1.6, 8]} />
          <meshStandardMaterial color="#6b3f1f" flatShading />
        </mesh>
      ))}
      {fire > 0 &&
        parts.map((p, i) => {
          const t = (frame * 0.035 * p.s + p.o) % 1;
          const s = (1 - t) * 0.42 * fire;
          const col = new THREE.Color('#ffd23a').lerp(new THREE.Color('#ff3b1a'), t);
          return (
            <mesh key={i} position={[Math.cos(p.a) * p.r * (1 - t), 0.3 + t * 2.0 * fire, Math.sin(p.a) * p.r * (1 - t)]} scale={s}>
              <icosahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={col} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          );
        })}
      {frame > outAt &&
        new Array(10).fill(0).map((_, i) => {
          const t = ((frame - outAt) * 0.02 + i / 10) % 1;
          return (
            <mesh key={i} position={[Math.sin(i * 2.1 + t * 3) * 0.3, 0.4 + t * 3.5, 0]} scale={0.25 + t * 0.6}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color="#9ca3af" transparent opacity={0.5 * (1 - t)} flatShading depthWrite={false} />
            </mesh>
          );
        })}
      <Person position={[2.3, 0, 0.6]} rotationY={-1.1} color="#ef4444" headShake={frame > outAt ? Math.sin(frame * 0.5) * 0.15 : 0} />
      <Person position={[-2.3, 0, 0.4]} rotationY={1.1} color="#22c55e" headShake={frame > outAt ? Math.sin(frame * 0.5 + 1) * 0.15 : 0} />
    </>
  );
};

// ───────── 人: 耳キーン / 実は平気 ─────────
const Park: React.FC = () => (
  <>
    <Sky top="#5fb2ff" bottom="#e0f2ff" />
    <ambientLight intensity={0.8} />
    <directionalLight position={[5, 10, 6]} intensity={2.2} />
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[40, 32]} />
      <meshStandardMaterial color="#86c26a" />
    </mesh>
    {new Array(8).fill(0).map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <group key={i} position={[Math.cos(a) * 9, 0, Math.sin(a) * 9 - 4]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 1.6, 6]} />
            <meshStandardMaterial color="#7c4a1e" flatShading />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <icosahedronGeometry args={[1.0, 0]} />
            <meshStandardMaterial color="#2f8f3a" flatShading />
          </mesh>
        </group>
      );
    })}
  </>
);

export const PersonEars: React.FC<P> = ({frame, frames}) => {
  const popAt = Math.round(frames * 0.45);
  const shake = frame > popAt ? Math.sin(frame * 2.2) * 0.25 * (1 - prog(frame, popAt, popAt + 30)) : 0;
  const z = lerp(6, 4.4, ease(prog(frame, 0, frames)));
  return (
    <>
      <Park />
      <Cam pos={[0, 2.1, z]} look={[0, 1.7, 0]} />
      <Person headShake={shake} armUp={frame > popAt ? 0.55 : 0} />
      {frame > popAt &&
        [0, 1, 2].map((i) => {
          const t = ((frame - popAt) * 0.06 + i / 3) % 1;
          return [-1, 1].map((s) => (
            <mesh key={`${i}${s}`} position={[s * (0.55 + t * 0.6), 2.05, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.15 + t * 0.3, 0.02, 6, 20, Math.PI]} />
              <meshBasicMaterial color="#facc15" transparent opacity={1 - t} />
            </mesh>
          ));
        })}
    </>
  );
};

export const PersonOk: React.FC<P> = ({frame}) => (
  <>
    <Park />
    <Cam pos={[Math.sin(frame * 0.02) * 1.5, 2.2, 5]} look={[0, 1.4, 0]} />
    <Person bounce={Math.abs(Math.sin(frame * 0.25)) * 0.35} armUp={0.9} />
    <Person position={[-1.8, 0, -1]} color="#f97316" bounce={Math.abs(Math.sin(frame * 0.25 + 1)) * 0.25} armUp={0.6} />
    <Person position={[1.8, 0, -1]} color="#a855f7" bounce={Math.abs(Math.sin(frame * 0.25 + 2)) * 0.25} armUp={0.6} />
  </>
);

// ───────── 海が消える ─────────
export const Ocean: React.FC<P> = ({frame, frames}) => {
  const vanishAt = Math.round(frames * 0.3);
  const k = ease(prog(frame, vanishAt, vanishAt + frames * 0.45));
  const level = lerp(0, -3.2, k);
  const geo = useMemo(() => new THREE.PlaneGeometry(60, 60, 70, 70), []);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.5 + frame * 0.12) * 0.18 + Math.cos(y * 0.6 + frame * 0.09) * 0.15);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const rocks = useMemo(
    () => new Array(40).fill(0).map((_, i) => ({x: (rnd(`rx${i}`) - 0.5) * 30, z: -rnd(`rz${i}`) * 25, s: 0.3 + rnd(`rs${i}`) * 1.2})),
    []
  );
  return (
    <>
      <Sky top="#3d8bff" bottom="#cfe8ff" />
      <fog attach="fog" args={['#cfe8ff', 20, 60]} />
      <Cam pos={[0, lerp(4, 7, k), 10]} look={[0, lerp(0, -2.5, k), -4]} fov={55} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 12, 4]} intensity={2.3} />
      <mesh position={[0, -3.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#b08d57" />
      </mesh>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, -3.5, r.z]} scale={r.s}>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#6b5b45" flatShading />
        </mesh>
      ))}
      <mesh position={[3, -3.4, -3]} rotation={[0, 0.6, 0.25]}>
        <boxGeometry args={[3.2, 0.8, 1]} />
        <meshStandardMaterial color="#7f1d1d" flatShading />
      </mesh>
      {k < 0.98 && (
        <mesh geometry={geo} position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#1e6fd9" transparent opacity={0.88 * (1 - k * 0.6)} flatShading roughness={0.3} />
        </mesh>
      )}
      {frame > vanishAt &&
        new Array(60).fill(0).map((_, i) => {
          const t = ((frame - vanishAt) * 0.02 * (0.7 + rnd(`bs${i}`)) + rnd(`bo${i}`)) % 1;
          return (
            <mesh key={i} position={[(rnd(`bx2${i}`) - 0.5) * 24, level + t * 9, -rnd(`bz2${i}`) * 18]} scale={0.08 + t * 0.25}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.7 * (1 - t)} />
            </mesh>
          );
        })}
    </>
  );
};

// ───────── 地面が崩れる ─────────
export const Crumble: React.FC<P> = ({frame, frames}) => {
  const startAt = Math.round(frames * 0.25);
  const N = 14;
  const tiles = useMemo(
    () =>
      new Array(N * N).fill(0).map((_, i) => {
        const gx = (i % N) - N / 2 + 0.5, gz = Math.floor(i / N) - N / 2 + 0.5;
        return {gx, gz, delay: Math.hypot(gx, gz) * 2.2 + rnd(`td${i}`) * 10, spin: rnd(`ts${i}`) - 0.5, house: rnd(`th${i}`) > 0.86};
      }),
    []
  );
  return (
    <>
      <Sky top="#ff9a5a" bottom="#ffe1c2" />
      <Cam pos={[9, lerp(8, 11, prog(frame, 0, frames)), 9]} look={[0, -1, 0]} fov={50} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 12, 4]} intensity={2.2} />
      <mesh position={[0, -14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#ff5a1a" />
      </mesh>
      <pointLight position={[0, -8, 0]} color="#ff6a1a" intensity={60} distance={30} />
      {tiles.map((t, i) => {
        const tt = Math.max(0, frame - startAt - t.delay);
        const y = -0.012 * tt * tt;
        if (y < -20) return null;
        const rot = tt * 0.03 * t.spin;
        return (
          <group key={i} position={[t.gx, y, t.gz]} rotation={[rot, 0, rot * 0.7]}>
            <mesh position={[0, -0.5, 0]}>
              <boxGeometry args={[0.98, 1, 0.98]} />
              <meshStandardMaterial color="#8b5a2b" flatShading />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[0.98, 0.06, 0.98]} />
              <meshStandardMaterial color="#5fae4a" flatShading />
            </mesh>
            {t.house && (
              <group position={[0, 0.05, 0]}>
                <mesh position={[0, 0.3, 0]}>
                  <boxGeometry args={[0.6, 0.5, 0.6]} />
                  <meshStandardMaterial color="#f1f5f9" flatShading />
                </mesh>
                <mesh position={[0, 0.72, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[0.5, 0.4, 4]} />
                  <meshStandardMaterial color="#dc2626" flatShading />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
};

export const SCENES = {
  earthIntro: EarthIntro,
  city: City,
  fire: Fire,
  person: PersonEars,
  personOk: PersonOk,
  ocean: Ocean,
  crumble: Crumble,
  earthEnd: EarthEnd,
};
