// 少しリアル寄りのモデル部品(角を丸め、細部を追加)
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {rnd} from '../lib';

// ───────── 共通ジオメトリ(使い回して軽くする) ─────────
const geoCache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
};
export const rbox = (w: number, h: number, d: number, r = 0.08, seg = 3) =>
  cached(`rb${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}_${r}_${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));

// ───────── ライティング: 影と環境光 ─────────
/** 全メッシュに影を設定し、柔らかい環境光(室内反射風)を当てる */
export const Realism: React.FC<{envIntensity?: number}> = ({envIntensity = 0.3}) => {
  const {gl, scene, camera} = useThree();
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return t;
  }, [gl]);
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 0.95;
  scene.environment = env;
  (scene as any).environmentIntensity = envIntensity;
  // 子のメッシュが作られた後(同じコミット内)に影の設定をして描き直す
  useLayoutEffect(() => {
    let changed = false;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      const cast = !(mat && (mat as any).transparent);
      if (m.castShadow !== cast || !m.receiveShadow) {
        m.castShadow = cast;
        m.receiveShadow = true;
        changed = true;
      }
    });
    if (changed) gl.render(scene, camera);
  });
  return null;
};

/** 影を落とす太陽光 */
export const SunLight: React.FC<{color?: string; intensity?: number; position?: [number, number, number]; size?: number}> = ({
  color = '#ffffff',
  intensity = 2.2,
  position = [12, 18, 10],
  size = 30,
}) => (
  <directionalLight
    position={position}
    color={color}
    intensity={intensity}
    castShadow
    shadow-mapSize={[2048, 2048]}
    shadow-bias={-0.0004}
    shadow-normalBias={0.02}
    shadow-camera-left={-size}
    shadow-camera-right={size}
    shadow-camera-top={size}
    shadow-camera-bottom={-size}
    shadow-camera-near={0.5}
    shadow-camera-far={80}
  />
);

// ───────── テクスチャ ─────────
const windowTex = (lit: boolean) => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const on = lit && rnd(`win${x}${y}`) > 0.35;
      g.fillStyle = on ? '#ffd88a' : '#3a4a63';
      g.fillRect(10 + x * 30, 10 + y * 30, 20, 22);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(10 + x * 30, 10 + y * 30, 20, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const noiseTex = (base: string, spread: number, key: string) => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = (rnd(`${key}n${i}`) - 0.5) * spread;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(rnd(`${key}x${i}`) * 256, rnd(`${key}y${i}`) * 256, 3, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** 草地っぽい地面(色はかけ合わせ) */
export const Ground: React.FC<{color: string; size?: number; y?: number; circle?: boolean}> = ({color, size = 200, y = -0.01, circle}) => {
  const tex = useMemo(() => {
    const t = noiseTex('#ffffff', 0.35, 'grass');
    t.repeat.set(size / 6, size / 6);
    return t;
  }, [size]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      {circle ? <circleGeometry args={[size / 2, 64]} /> : <planeGeometry args={[size, size]} />}
      <meshStandardMaterial color={color} map={tex} roughness={0.95} />
    </mesh>
  );
};

/** アスファルトの道路と歩道 */
export const Road: React.FC<{color?: string}> = ({color = '#4b5563'}) => {
  const tex = useMemo(() => {
    const t = noiseTex('#ffffff', 0.25, 'asph');
    t.repeat.set(40, 1);
    return t;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 5]} />
        <meshStandardMaterial color={color} map={tex} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.08, s * 3.1]}>
          <boxGeometry args={[200, 0.16, 1.2]} />
          <meshStandardMaterial color="#c9ccd1" roughness={0.85} />
        </mesh>
      ))}
      {new Array(40).fill(0).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-60 + i * 3, 0.012, 0]}>
          <planeGeometry args={[1.2, 0.14]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// ───────── 建物 ─────────
export const Building: React.FC<{w: number; h: number; color: string; lit?: boolean; seed: string}> = ({w, h, color, lit = false, seed}) => {
  const tex = useMemo(() => {
    const t = windowTex(lit);
    t.repeat.set(Math.max(1, Math.round(w / 1.1)), Math.max(1, Math.round(h / 1.1)));
    return t;
  }, [w, h, lit]);
  const roofH = 0.18;
  const hasTank = rnd(`${seed}tank`) > 0.6;
  return (
    <group>
      <mesh geometry={rbox(w, h, w, 0.12)}>
        <meshStandardMaterial color={color} map={tex} roughness={0.7} metalness={0.05} emissive={lit ? '#ffb347' : '#000000'} emissiveMap={lit ? tex : null} emissiveIntensity={lit ? 0.35 : 0} />
      </mesh>
      <mesh position={[0, h / 2 + roofH / 2, 0]} geometry={rbox(w + 0.12, roofH, w + 0.12, 0.05)}>
        <meshStandardMaterial color="#9aa3ad" roughness={0.8} />
      </mesh>
      {hasTank && (
        <mesh position={[w * 0.2, h / 2 + 0.45, -w * 0.15]}>
          <cylinderGeometry args={[0.22, 0.22, 0.5, 20]} />
          <meshStandardMaterial color="#d1d5db" roughness={0.5} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
};

// ───────── 車 ─────────
export const Car: React.FC<{color: string; dir: number; smoke: number; lights?: boolean}> = ({color, dir, smoke, lights}) => (
  <group rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
    <mesh position={[0, 0.42, 0]} geometry={rbox(1.7, 0.42, 0.86, 0.14, 4)}>
      <meshPhysicalMaterial color={color} roughness={0.28} metalness={0.4} clearcoat={1} clearcoatRoughness={0.15} />
    </mesh>
    <mesh position={[-0.12, 0.78, 0]} geometry={rbox(0.95, 0.36, 0.78, 0.14, 4)}>
      <meshPhysicalMaterial color={color} roughness={0.28} metalness={0.4} clearcoat={1} />
    </mesh>
    {/* 窓 */}
    <mesh position={[-0.12, 0.8, 0]} geometry={rbox(0.97, 0.26, 0.8, 0.1, 3)}>
      <meshPhysicalMaterial color="#1e293b" roughness={0.05} metalness={0.6} />
    </mesh>
    {/* タイヤ */}
    {[-0.55, 0.55].map((wx) =>
      [-0.42, 0.42].map((wz) => (
        <group key={`${wx}${wz}`} position={[wx, 0.2, wz]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 24]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.072 * Math.sign(wz), 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.01, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      ))
    )}
    {/* ライト */}
    {[-0.28, 0.28].map((z) => (
      <React.Fragment key={z}>
        <mesh position={[0.86, 0.48, z]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color="#fffbe6" emissive="#fff4c2" emissiveIntensity={lights ? 3 : 0.6} />
        </mesh>
        <mesh position={[-0.86, 0.48, z]}>
          <boxGeometry args={[0.02, 0.08, 0.16]} />
          <meshStandardMaterial color="#b91c1c" emissive="#ef4444" emissiveIntensity={lights ? 2 : 0.4} />
        </mesh>
      </React.Fragment>
    ))}
    {smoke > 0 && (
      <mesh position={[-1.05, 0.4 + smoke * 0.6, 0]} scale={0.2 + smoke * 0.5}>
        <sphereGeometry args={[0.5, 20, 16]} />
        <meshStandardMaterial color="#9ca3af" transparent opacity={0.6 * (1 - smoke)} roughness={1} />
      </mesh>
    )}
  </group>
);

// ───────── 木 ─────────
export const Tree: React.FC<{color: string; seed: string; scale?: number}> = ({color, seed, scale = 1}) => {
  const blobs = useMemo(
    () =>
      new Array(5).fill(0).map((_, i) => ({
        p: [(rnd(`${seed}tx${i}`) - 0.5) * 0.9, 2.0 + rnd(`${seed}ty${i}`) * 0.8, (rnd(`${seed}tz${i}`) - 0.5) * 0.9] as [number, number, number],
        r: 0.55 + rnd(`${seed}tr${i}`) * 0.35,
        shade: rnd(`${seed}ts${i}`) * 0.25,
      })),
    [seed]
  );
  return (
    <group scale={scale}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.12, 0.2, 1.8, 14]} />
        <meshStandardMaterial color="#6b4423" roughness={0.95} />
      </mesh>
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p}>
          <sphereGeometry args={[b.r, 24, 18]} />
          <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(1 - b.shade)} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
};

// ───────── 人 ─────────
const SKIN = ['#f6d3b3', '#e8b98f', '#c98e62', '#8d5a3b'];
const HAIR = ['#2b1d14', '#3f2a1d', '#111111', '#6b4423', '#c8a26b'];

export const Human: React.FC<{
  color?: string;
  pants?: string;
  seed?: string;
  position?: [number, number, number];
  rotationY?: number;
  headShake?: number;
  bounce?: number;
  armUp?: number;
  scale?: number;
}> = ({color = '#3b82f6', pants = '#1f2937', seed = 'h', position = [0, 0, 0], rotationY = 0, headShake = 0, bounce = 0, armUp = 0, scale = 1}) => {
  const skin = SKIN[Math.floor(rnd(`${seed}sk`) * SKIN.length)];
  const hair = HAIR[Math.floor(rnd(`${seed}hr`) * HAIR.length)];
  const longHair = rnd(`${seed}lh`) > 0.55;
  const cloth = {roughness: 0.85};
  const arm = (side: number) => (
    <group position={[side * 0.43, 1.52, 0]} rotation={[0, 0, side * (0.12 + armUp * 2.3)]}>
      <mesh position={[0, -0.27, 0]}>
        <capsuleGeometry args={[0.09, 0.42, 8, 16]} />
        <meshStandardMaterial color={color} {...cloth} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <capsuleGeometry args={[0.075, 0.22, 8, 16]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.78, 0]}>
        <sphereGeometry args={[0.085, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
    </group>
  );
  return (
    <group position={[position[0], position[1] + bounce, position[2]]} rotation={[0, rotationY, 0]} scale={scale}>
      {/* 脚と靴 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.13, 0.5, 0]}>
            <capsuleGeometry args={[0.11, 0.62, 8, 16]} />
            <meshStandardMaterial color={pants} {...cloth} />
          </mesh>
          <mesh position={[s * 0.13, 0.07, 0.06]} geometry={rbox(0.2, 0.13, 0.34, 0.06)}>
            <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* 胴体 */}
      <mesh position={[0, 1.22, 0]}>
        <capsuleGeometry args={[0.3, 0.55, 10, 24]} />
        <meshStandardMaterial color={color} {...cloth} />
      </mesh>
      {arm(-1)}
      {arm(1)}
      {/* 首と頭 */}
      <mesh position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.14, 16]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
      <group position={[0, 1.98, 0]} rotation={[0, 0, headShake]}>
        <mesh scale={[1, 1.1, 1]}>
          <sphereGeometry args={[0.24, 32, 24]} />
          <meshStandardMaterial color={skin} roughness={0.55} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.085, 0.03, 0.205]}>
              <sphereGeometry args={[0.04, 16, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[s * 0.085, 0.03, 0.238]}>
              <sphereGeometry args={[0.022, 12, 10]} />
              <meshStandardMaterial color="#1b130e" roughness={0.2} />
            </mesh>
            <mesh position={[s * 0.235, 0, 0]} scale={[0.5, 1, 0.8]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshStandardMaterial color={skin} roughness={0.6} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.03, 0.235]}>
          <sphereGeometry args={[0.03, 12, 10]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.11, 0.2]} rotation={[0, 0, Math.PI]} scale={[1, 0.5, 1]}>
          <torusGeometry args={[0.045, 0.012, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#9a3b3b" roughness={0.5} />
        </mesh>
        {/* 髪 */}
        <mesh position={[0, 0.06, -0.02]} scale={[1.06, 1.0, 1.08]}>
          <sphereGeometry args={[0.25, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={hair} roughness={0.7} />
        </mesh>
        {longHair && (
          <mesh position={[0, -0.12, -0.12]} scale={[1.05, 1.3, 0.6]}>
            <sphereGeometry args={[0.24, 24, 18]} />
            <meshStandardMaterial color={hair} roughness={0.7} />
          </mesh>
        )}
      </group>
    </group>
  );
};
