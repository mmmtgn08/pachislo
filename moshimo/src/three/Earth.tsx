import React, {useMemo} from 'react';
import * as THREE from 'three';
import {rnd} from '../lib';

// 決定的なバリューノイズ
const hash = (x: number, y: number, s: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number, s: number, wrap: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = (v: number) => ((v % wrap) + wrap) % wrap;
  const a = hash(w(xi), yi, s), b = hash(w(xi + 1), yi, s);
  const c = hash(w(xi), yi + 1, s), d = hash(w(xi + 1), yi + 1, s);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number, s: number, base: number) => {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * vnoise(x * f, y * f, s + o, base * f);
    amp *= 0.5;
    f *= 2;
  }
  return v;
};

const makeTextures = () => {
  const W = 512, H = 256, base = 6;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const cc = document.createElement('canvas');
  cc.width = W;
  cc.height = H;
  const cg = cc.getContext('2d')!;
  const cimg = cg.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = Math.abs(y / H - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * base, ny = (y / H) * base * 0.5;
      const h = fbm(nx, ny, 1, base);
      const i = (y * W + x) * 4;
      let r, gg, b;
      if (lat > 0.86) {
        [r, gg, b] = [240, 248, 255];
      } else if (h > 0.53) {
        const t = Math.min(1, (h - 0.53) * 5);
        const dry = lat < 0.35 && fbm(nx + 9, ny, 3, base) > 0.55;
        [r, gg, b] = dry ? [196 - t * 30, 170 - t * 30, 110] : [70 + t * 60, 150 - t * 30, 60];
      } else {
        const t = h / 0.53;
        [r, gg, b] = [20 + t * 30, 70 + t * 70, 150 + t * 60];
      }
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      const cl = fbm(nx * 1.5 + 30, ny * 1.5, 7, base * 1.5);
      cimg.data[i] = cimg.data[i + 1] = cimg.data[i + 2] = 255;
      cimg.data[i + 3] = Math.max(0, Math.min(255, (cl - 0.5) * 900));
    }
  }
  g.putImageData(img, 0, 0);
  cg.putImageData(cimg, 0, 0);
  const t1 = new THREE.CanvasTexture(c);
  t1.colorSpace = THREE.SRGBColorSpace;
  const t2 = new THREE.CanvasTexture(cc);
  t2.colorSpace = THREE.SRGBColorSpace;
  return {surface: t1, clouds: t2};
};

const FRAG_COLORS = ['#2563eb', '#1d4ed8', '#16a34a', '#4d7c0f', '#a16207', '#78716c', '#57534e'];

export const Earth: React.FC<{
  rotation: number;
  atmosphere?: number; // 0..1
  clouds?: number; // 0..1
  crumble?: number; // 0..1 (0 = 無傷)
  ice?: number; // 0..1 凍りつく
  lights?: number; // 0..1 夜側の街明かり
  strip?: number; // 0..1 大気や海が宇宙へ流れ出す
  radius?: number;
}> = ({rotation, atmosphere = 1, clouds = 1, crumble = 0, ice = 0, lights = 0, strip = 0, radius = 2}) => {
  const tex = useMemo(makeTextures, []);
  const frags = useMemo(
    () =>
      new Array(420).fill(0).map((_, i) => {
        const u = rnd(`f${i}a`) * 2 - 1;
        const th = rnd(`f${i}b`) * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        return {
          dir: new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th)),
          size: 0.12 + rnd(`f${i}c`) * 0.22,
          speed: 0.6 + rnd(`f${i}d`) * 1.6,
          spin: rnd(`f${i}e`) * 6,
          color: FRAG_COLORS[Math.floor(rnd(`f${i}g`) * FRAG_COLORS.length)],
        };
      }),
    []
  );

  if (crumble > 0) {
    const k = crumble;
    return (
      <group rotation={[0.35, rotation, 0]}>
        <mesh>
          <icosahedronGeometry args={[radius * (0.55 - 0.15 * k), 3]} />
          <meshBasicMaterial color="#ff7a1a" />
        </mesh>
        <pointLight color="#ff8a3a" intensity={30 * (1 - k * 0.5)} distance={20} />
        {frags.map((f, i) => {
          const d = radius * (0.95 + k * f.speed * 2.2);
          return (
            <mesh
              key={i}
              position={[f.dir.x * d, f.dir.y * d, f.dir.z * d]}
              rotation={[f.spin * k * 2, f.spin * k * 3, 0]}
            >
              <dodecahedronGeometry args={[f.size, 0]} />
              <meshStandardMaterial color={f.color} flatShading />
            </mesh>
          );
        })}
      </group>
    );
  }

  return (
    <group rotation={[0.35, 0, 0]}>
      <mesh rotation={[0, rotation, 0]}>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshStandardMaterial map={tex.surface} roughness={0.9} />
      </mesh>
      {clouds > 0 && (
        <mesh rotation={[0, rotation * 1.25, 0]}>
          <sphereGeometry args={[radius * 1.015, 64, 48]} />
          <meshStandardMaterial map={tex.clouds} transparent opacity={clouds} depthWrite={false} />
        </mesh>
      )}
      {ice > 0 && (
        <mesh rotation={[0, rotation, 0]}>
          <sphereGeometry args={[radius * 1.008, 64, 48]} />
          <meshStandardMaterial color="#eef8ff" transparent opacity={0.92 * ice} roughness={0.4} depthWrite={false} />
        </mesh>
      )}
      {lights > 0 && (
        <group rotation={[0, rotation, 0]}>
          {frags.slice(0, 260).map((f, i) => (
            <mesh key={i} position={[f.dir.x * radius * 1.004, f.dir.y * radius * 1.004, f.dir.z * radius * 1.004]}>
              <sphereGeometry args={[0.018 + f.size * 0.05, 4, 4]} />
              <meshBasicMaterial color="#ffd27a" transparent opacity={lights} />
            </mesh>
          ))}
        </group>
      )}
      {strip > 0 &&
        frags.slice(0, 200).map((f, i) => {
          const t = (strip * 1.6 + f.speed * 0.3) % 1;
          const d = radius * (1.02 + t * 2.2);
          return (
            <mesh key={`s${i}`} position={[f.dir.x * d, f.dir.y * d, f.dir.z * d]} scale={0.05 + 0.06 * (1 - t)}>
              <sphereGeometry args={[1, 6, 6]} />
              <meshBasicMaterial color={i % 3 ? '#7cc4ff' : '#ffffff'} transparent opacity={(1 - t) * Math.min(1, strip * 4)} />
            </mesh>
          );
        })}
      {atmosphere > 0 && (
        <mesh>
          <sphereGeometry args={[radius * 1.06, 48, 32]} />
          <meshBasicMaterial
            color="#4da6ff"
            transparent
            opacity={0.35 * atmosphere}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};
