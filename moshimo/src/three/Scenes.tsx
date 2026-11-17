import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Cam, Person, Stars} from './common';
import {Building, Car, Ground, Realism, Road, Tree, rbox} from './models';
import {Animals, Room, SkyScene, Space, Underwater} from './Scenes2';
import {Earth} from './Earth';
import {Affected, Outdoor, darkK, eventAt, freezeK, iced} from './events';
import {Style, ease, lerp, prog, rnd} from '../lib';

export type SceneProps = {frame: number; frames: number; style: Style; event?: string; variant: number};

type V3 = [number, number, number];
/** variant(0..2) ごとのカメラ: [開始位置, 終了位置, 注視点] */
const camPath = (variant: number, paths: [V3, V3, V3][], frame: number, frames: number) => {
  const [a, b, look] = paths[variant % paths.length];
  const t = ease(prog(frame, 0, frames));
  return {pos: [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as V3, look};
};

// ───────── 宇宙から地球 ─────────
export const EarthIntro: React.FC<SceneProps> = ({frame, frames, variant}) => {
  const c = camPath(variant, [
    [[0, 0.4, 9.5], [0, 0.4, 6.2], [0, 0, 0]],
    [[-4, 2.5, 8], [-1.5, 1, 6], [0, 0, 0]],
    [[3, -1.5, 8.5], [1.2, -0.3, 6.3], [0, 0, 0]],
  ], frame, frames);
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Cam pos={c.pos} look={c.look} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 2, 5]} intensity={2.6} />
      <Stars />
      <Earth rotation={frame * 0.006 + variant} />
    </>
  );
};

/** 地球のエンディング: crumble / ice / dark / fine / float */
export const EarthEnd: React.FC<SceneProps> = ({frame, frames, event = 'crumble', variant}) => {
  const k = ease(prog(frame, 10, frames * 0.75));
  const zoomOut = event === 'crumble' || event === 'impact' ? lerp(7.5, 12, k) : lerp(6.5, 8, k);
  const sunI = event === 'dark' ? 2.4 * (1 - k * 0.95) : 2.4;
  const side = [0, -2, 2][variant % 3];
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Cam pos={[side, 0.6, zoomOut]} />
      <ambientLight intensity={event === 'dark' ? 0.25 * (1 - k * 0.7) : 0.35} />
      <directionalLight position={[5, 2, 5]} intensity={sunI} />
      <Stars />
      <Earth
        rotation={0.8 + frame * 0.01}
        crumble={event === 'crumble' ? k : event === 'impact' ? ease(prog(frame, frames * 0.38, frames * 0.85)) : 0}
        atmosphere={event === 'crumble' || event === 'float' ? 1 - k : 1}
        clouds={event === 'crumble' ? 1 - k : event === 'ice' ? 1 - k * 0.5 : 1}
        ice={event === 'ice' ? k : 0}
        lights={event === 'dark' ? k : 0}
        strip={event === 'float' ? k : 0}
        burn={event === 'burn' ? k : 0}
      />
      {event === 'impact' && <AsteroidHit frame={frame} frames={frames} />}
    </>
  );
};

/** 巨大隕石が地球に衝突する */
const AsteroidHit: React.FC<{frame: number; frames: number}> = ({frame, frames}) => {
  const hitAt = frames * 0.35;
  const p = Math.min(1, frame / hitAt);
  const start = new THREE.Vector3(7, 5, -4), end = new THREE.Vector3(1.4, 0.9, 0.6);
  const pos = start.clone().lerp(end, ease(p));
  const t = (frame - hitAt) / 30;
  return (
    <>
      {p < 1 && (
        <group position={pos.toArray() as V3}>
          <mesh>
            <icosahedronGeometry args={[0.45, 1]} />
            <meshStandardMaterial color="#3b2a20" emissive="#ff6a1a" emissiveIntensity={1.2} roughness={1} />
          </mesh>
          <mesh position={[0.9, 0.8, -0.6]} rotation={[0, 0, 0.85]}>
            <coneGeometry args={[0.4, 2.4, 16, 1, true]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color="#ff8a3a" intensity={40} distance={10} />
        </group>
      )}
      {t >= 0 && t < 1.5 && (
        <mesh position={end.toArray() as V3} scale={0.5 + t * 8}>
          <sphereGeometry args={[0.5, 24, 16]} />
          <meshBasicMaterial color="#fff2c4" transparent opacity={Math.max(0, 1 - t / 1.2)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </>
  );
};

// ───────── 街 ─────────
export const City: React.FC<SceneProps> = ({frame, frames, style, event, variant}) => {
  const at = eventAt(frames);
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  const dk = event === 'dark' ? darkK(frame, at) : 0;
  const lightsOn = style.tod === 'night' || dk > 0.3;
  const buildings = useMemo(
    () =>
      new Array(36).fill(0).map((_, i) => {
        const side = i % 2 ? 1 : -1;
        const row = Math.floor(i / 2);
        return {
          x: -26 + row * 3 + rnd(`${style.seed}bx${i}`) * 0.6,
          z: side * (5 + rnd(`${style.seed}bz${i}`) * 3),
          h: side > 0 ? 1.2 + rnd(`${style.seed}bh${i}`) * 1.5 : 3 + rnd(`${style.seed}bh${i}`) * 8,
          w: 1.8 + rnd(`${style.seed}bw${i}`) * 0.8,
          c: style.buildings[Math.floor(rnd(`${style.seed}bc${i}`) * style.buildings.length)],
        };
      }),
    [style]
  );
  const cars = useMemo(
    () =>
      new Array(14).fill(0).map((_, i) => ({
        lane: i % 2 ? 1.2 : -1.2,
        dir: i % 2 ? -1 : 1,
        off: rnd(`${style.seed}co${i}`) * 50,
        speed: 0.25 + rnd(`${style.seed}cs${i}`) * 0.12,
        color: style.cars[i % style.cars.length],
      })),
    [style]
  );
  const stops = ['stall', 'freeze', 'float', 'wind', 'explode', 'tsunami', 'meteor', 'burn'].includes(event ?? '');
  const dist = (f: number, v: number) => {
    if (!stops || f <= at) return f * v;
    const dec = Math.min(f - at, 12);
    return at * v + v * (dec - (dec * dec) / 24);
  };
  const t = ease(prog(frame, 0, frames));
  const camX = lerp(-6, 2, t);
  const cams: [V3, V3][] = [
    [[camX, 11, 17], [camX + 4, 0.5, -1]],
    [[lerp(-14, -8, t), 7, 13], [lerp(-6, 0, t), 2.5, -3]],
    [[lerp(4, 0, t), 22, 6], [lerp(4, 0, t), 0, -1]],
  ];
  const [cpos, clook] = cams[variant % 3];
  const ground = iced(style.ground, fz);
  return (
    <>
      <Outdoor style={style} frame={frame} at={at} event={event} />
      <Cam pos={cpos} look={clook} fov={50} />
      <Ground color={ground} />
      <Road color={iced('#4b5563', fz)} />
      {buildings.map((b, i) => (
        <Affected key={i} event={event === 'freeze' || event === 'explode' || event === 'tsunami' ? event : undefined} frame={frame} at={at + 6} id={`b${i}`} position={[b.x, b.h / 2, b.z]} power={event === 'explode' ? 0.15 : event === 'tsunami' ? 0.3 : 1}>
          <Building w={b.w} h={b.h} color={iced(b.c, fz)} lit={lightsOn} seed={`${style.seed}b${i}`} />
        </Affected>
      ))}
      {cars.map((c, i) => {
        const d = dist(frame, c.speed);
        const x = ((((c.off + d * c.dir) % 50) + 50) % 50) - 25;
        const smoke = event === 'stall' && frame > at ? prog(frame, at, at + 25) : 0;
        return (
          <Affected key={i} event={event} frame={frame} at={at} id={`c${i}`} position={[x, 0, c.lane]}>
            <Car color={iced(c.color, fz)} dir={c.dir} smoke={smoke} lights={lightsOn} />
          </Affected>
        );
      })}
      {new Array(6).fill(0).map((_, i) => (
        <Affected key={i} event={event} frame={frame} at={at} id={`p${i}`} position={[-8 + i * 3.2, 0, 3 + (i % 2) * 0.8]} rotation={[0, -0.4, 0]}>
          <Person color={iced(style.people[i % style.people.length], fz)} scale={0.55} />
        </Affected>
      ))}
    </>
  );
};

// ───────── 焚き火 ─────────
export const Fire: React.FC<SceneProps> = ({frame, frames, style, event = 'out', variant}) => {
  const at = eventAt(frames);
  const level = event === 'out' ? 1 - prog(frame, at, at + 8) : event === 'grow' ? 1 + 1.6 * ease(prog(frame, at, at + 12)) : 1;
  const flick = 0.85 + 0.15 * Math.sin(frame * 1.7) * Math.sin(frame * 0.9);
  const parts = useMemo(
    () => new Array(46).fill(0).map((_, i) => ({a: rnd(`fa${i}`) * Math.PI * 2, r: rnd(`fr${i}`) * 0.45, o: rnd(`fo${i}`), s: 0.6 + rnd(`fs${i}`) * 0.6})),
    []
  );
  const c = camPath(variant, [
    [[0, 2.4, 6.5], [0, 2.6, 5], [0, 1, 0]],
    [[-5, 1.4, 4], [-3.5, 1.6, 3.2], [0, 1.2, 0]],
    [[0, 6, 3], [0, 5, 2.4], [0, 0.5, 0]],
  ], frame, frames);
  const scared = event === 'grow' && frame > at;
  return (
    <>
      <color attach="background" args={['#0b1026']} />
      <fog attach="fog" args={['#0b1026', 8, 30]} />
      <Cam pos={c.pos} look={c.look} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, 6, 5]} color="#9db4ff" intensity={0.9} />
      <Stars count={600} radius={40} />
      <Realism envIntensity={0.15} />
      <pointLight position={[0, 1.2, 0]} color="#ff9a3c" intensity={40 * Math.min(level, 2) * flick} distance={14 + level * 4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial color="#2d3a2a" roughness={1} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.15, 0]} rotation={[0, (i * Math.PI) / 4, Math.PI / 2.3]}>
          <cylinderGeometry args={[0.12, 0.14, 1.6, 16]} />
          <meshStandardMaterial color="#6b3f1f" />
        </mesh>
      ))}
      {level > 0 &&
        parts.map((p, i) => {
          const t = (frame * 0.035 * p.s + p.o) % 1;
          const s = (1 - t) * 0.42 * level;
          const col = new THREE.Color('#ffd23a').lerp(new THREE.Color('#ff3b1a'), t);
          return (
            <mesh key={i} position={[Math.cos(p.a) * p.r * (1 - t) * level, 0.3 + t * 2.0 * level, Math.sin(p.a) * p.r * (1 - t) * level]} scale={s}>
              <icosahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={col} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          );
        })}
      {event === 'out' &&
        frame > at &&
        new Array(10).fill(0).map((_, i) => {
          const t = ((frame - at) * 0.02 + i / 10) % 1;
          return (
            <mesh key={i} position={[Math.sin(i * 2.1 + t * 3) * 0.3, 0.4 + t * 3.5, 0]} scale={0.25 + t * 0.6}>
              <sphereGeometry args={[1, 20, 16]} />
              <meshStandardMaterial color="#9ca3af" transparent opacity={0.5 * (1 - t)} depthWrite={false} />
            </mesh>
          );
        })}
      <Person position={[scared ? 3.2 : 2.3, 0, 0.6]} rotationY={-1.1} color={style.people[0]} headShake={frame > at ? Math.sin(frame * 0.5) * 0.15 : 0} armUp={scared ? 0.8 : 0} />
      <Person position={[scared ? -3.2 : -2.3, 0, 0.4]} rotationY={1.1} color={style.people[1]} headShake={frame > at ? Math.sin(frame * 0.5 + 1) * 0.15 : 0} armUp={scared ? 0.8 : 0} />
    </>
  );
};

// ───────── 公園と人 ─────────
export const Park: React.FC<SceneProps> = ({frame, frames, style, event = 'none', variant}) => {
  const at = eventAt(frames);
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  const c = camPath(variant, [
    [[0, 2.1, 6.5], [0, 2.1, 4.6], [0, 1.6, 0]],
    [[-3.5, 1.6, 5], [-2.2, 1.8, 4], [0, 1.5, 0]],
    [[2.5, 3.8, 6], [1.5, 3, 4.8], [0, 1.3, 0]],
  ], frame, frames);
  const ears = event === 'ears' && frame > at;
  const cheer = event === 'cheer';
  const shake = ears ? Math.sin(frame * 2.2) * 0.25 * (1 - prog(frame, at, at + 30)) : 0;
  const people: {p: V3; c: string; main?: boolean}[] = [
    {p: [0, 0, 0], c: style.people[0], main: true},
    {p: [-1.8, 0, -1], c: style.people[1]},
    {p: [1.8, 0, -1], c: style.people[2]},
  ];
  return (
    <>
      <Outdoor style={style} frame={frame} at={at} event={event} fogNear={15} fogFar={60} />
      <Cam pos={c.pos} look={c.look} />
      <Ground color={iced('#86c26a', fz)} size={80} circle />
      {new Array(8).fill(0).map((_, i) => {
        // カメラの通り道に入らないよう、人の後ろ側(半円)にだけ木を置く
        const a = Math.PI * (1.05 + (i / 7) * 0.9);
        return (
          <Affected key={i} event={event === 'freeze' || event === 'explode' ? event : undefined} frame={frame} at={at + 4} id={`t${i}`} position={[Math.cos(a) * 8, 0, Math.sin(a) * 6 - 3]}>
            <Tree color={iced('#2f8f3a', fz)} seed={`t${i}`} />
          </Affected>
        );
      })}
      {people.map((pp, i) => (
        <Affected key={i} event={event} frame={frame} at={at} id={`pp${i}`} position={pp.p} power={event === 'float' ? 0.3 : 1}>
          <Person
            color={iced(pp.c, fz * 0.6)}
            headShake={pp.main ? shake : 0}
            pose={ears && pp.main ? 'ears' : undefined}
            armUp={cheer ? 0.6 + (pp.main ? 0.3 : 0) : event === 'float' && frame > at ? 0.9 : 0}
            bounce={cheer ? Math.abs(Math.sin(frame * 0.25 + i)) * (pp.main ? 0.35 : 0.25) : 0}
          />
        </Affected>
      ))}
      {ears &&
        [0, 1, 2].map((i) => {
          const t = ((frame - at) * 0.06 + i / 3) % 1;
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

// ───────── 海 ─────────
export const Ocean: React.FC<SceneProps> = ({frame, frames, style, event = 'vanish', variant}) => {
  const at = eventAt(frames);
  const k = ease(prog(frame, at, at + frames * 0.45));
  const fz = event === 'freeze' ? freezeK(frame, at) : 0;
  const level = event === 'vanish' ? lerp(0, -3.2, k) : event === 'float' ? lerp(0, 0.8, k) : 0;
  const waveAmp = event === 'freeze' ? 1 - fz : event === 'wind' && frame > at ? 1 + 2.5 * prog(frame, at, at + 20) : 1;
  const geo = useMemo(() => new THREE.PlaneGeometry(60, 60, 70, 70), []);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const wf = event === 'freeze' ? Math.min(frame, at + 36) : frame; // 凍ると波が止まる
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, (Math.sin(x * 0.5 + wf * 0.12) * 0.18 + Math.cos(y * 0.6 + wf * 0.09) * 0.15) * waveAmp);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const rocks = useMemo(() => new Array(40).fill(0).map((_, i) => ({x: (rnd(`rx${i}`) - 0.5) * 30, z: -rnd(`rz${i}`) * 25, s: 0.3 + rnd(`rs${i}`) * 1.2})), []);
  const c = camPath(variant, [
    [[0, 4, 10], [0, 7, 10], [0, -1.2, -4]],
    [[-8, 2.5, 6], [-6, 4, 7], [0, -1, -3]],
    [[0, 12, 6], [0, 13, 5], [0, -2, -2]],
  ], frame, frames);
  return (
    <>
      <Outdoor style={style} frame={frame} at={at} event={event} fogNear={20} fogFar={60} />
      <Cam pos={c.pos} look={c.look} fov={55} />
      <mesh position={[0, -3.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#b08d57" />
      </mesh>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, -3.5, r.z]} scale={r.s}>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#6b5b45" flatShading roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[3, -3.4, -3]} rotation={[0, 0.6, 0.25]}>
        <boxGeometry args={[3.2, 0.8, 1]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      {!(event === 'vanish' && k > 0.98) && (
        <mesh geometry={geo} position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            color={fz > 0 ? iced('#1e6fd9', fz) : '#1e6fd9'}
            transparent
            opacity={event === 'vanish' ? 0.88 * (1 - k * 0.6) : fz > 0 ? 0.88 + 0.12 * fz : 0.88}
            roughness={0.12 + fz * 0.5}
            metalness={0.1}
          />
        </mesh>
      )}
      {(event === 'vanish' || event === 'float') &&
        frame > at &&
        new Array(60).fill(0).map((_, i) => {
          const t = ((frame - at) * 0.02 * (0.7 + rnd(`bs${i}`)) + rnd(`bo${i}`)) % 1;
          const big = event === 'float';
          return (
            <mesh key={i} position={[(rnd(`bx2${i}`) - 0.5) * 24, level + t * (big ? 14 : 9), -rnd(`bz2${i}`) * 18]} scale={big ? 0.3 + t * 0.6 : 0.08 + t * 0.25}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={big ? '#3b8ef0' : '#e0f2fe'} transparent opacity={(big ? 0.8 : 0.7) * (1 - t * 0.7)} />
            </mesh>
          );
        })}
    </>
  );
};

// ───────── 地面が崩れる ─────────
export const Crumble: React.FC<SceneProps> = ({frame, frames, style, variant}) => {
  const startAt = Math.round(frames * 0.25);
  const N = 14;
  const tiles = useMemo(
    () =>
      new Array(N * N).fill(0).map((_, i) => {
        const gx = (i % N) - N / 2 + 0.5, gz = Math.floor(i / N) - N / 2 + 0.5;
        return {gx, gz, delay: Math.hypot(gx, gz) * 2.2 + rnd(`td${i}`) * 10, spin: rnd(`ts${i}`) - 0.5, house: rnd(`${style.seed}th${i}`) > 0.86};
      }),
    [style]
  );
  const c = camPath(variant, [
    [[9, 8, 9], [9, 11, 9], [0, -1, 0]],
    [[-10, 6, 6], [-11, 9, 7], [0, -1, 0]],
    [[0.1, 16, 2], [0.1, 18, 2.5], [0, -2, 0]],
  ], frame, frames);
  return (
    <>
      <Outdoor style={{...style, tod: 'sunset', sky: {top: '#ff9a5a', bottom: '#ffe1c2'}, sun: {color: '#ffd2a8', intensity: 2.2, ambient: 0.7}}} frame={frame} at={0} />
      <Cam pos={c.pos} look={c.look} fov={50} />
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
            <mesh position={[0, -0.5, 0]} geometry={rbox(0.98, 1, 0.98, 0.06, 2)}>
              <meshStandardMaterial color="#8b5a2b" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.02, 0]} geometry={rbox(0.98, 0.08, 0.98, 0.03, 2)}>
              <meshStandardMaterial color={style.ground} roughness={0.9} />
            </mesh>
            {t.house && (
              <group position={[0, 0.05, 0]}>
                <mesh position={[0, 0.3, 0]}>
                  <boxGeometry args={[0.6, 0.5, 0.6]} />
                  <meshStandardMaterial color="#f1f5f9" />
                </mesh>
                <mesh position={[0, 0.72, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[0.5, 0.4, 4]} />
                  <meshStandardMaterial color="#dc2626" />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
};

export const SCENES: Record<string, React.FC<SceneProps>> = {
  earthIntro: EarthIntro,
  city: City,
  fire: Fire,
  park: Park,
  ocean: Ocean,
  crumble: Crumble,
  earthEnd: EarthEnd,
  space: Space,
  sky: SkyScene,
  underwater: Underwater,
  room: Room,
  animals: Animals,
};
