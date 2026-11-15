import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {rnd} from '../lib';
import {Human} from './models';

/** カメラ位置と注視点を毎フレーム指定する */
export const Cam: React.FC<{pos: [number, number, number]; look?: [number, number, number]; fov?: number}> = ({
  pos,
  look = [0, 0, 0],
  fov = 50,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pos);
  camera.lookAt(...look);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  return null;
};

export const Stars: React.FC<{count?: number; radius?: number}> = ({count = 1500, radius = 80}) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rnd(`s${i}a`) * 2 - 1;
      const th = rnd(`s${i}b`) * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      p[i * 3] = r * Math.cos(th) * radius;
      p[i * 3 + 1] = u * radius;
      p[i * 3 + 2] = r * Math.sin(th) * radius;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [count, radius]);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={0.25} sizeAttenuation />
    </points>
  );
};

/** 縦グラデーションの空 */
export const Sky: React.FC<{top: string; bottom: string}> = ({top, bottom}) => {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [top, bottom]);
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[120, 32, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} />
    </mesh>
  );
};

/** 人(models.tsx の Human を使う。seed が無ければ色と位置から決める) */
export const Person: React.FC<React.ComponentProps<typeof Human>> = (props) => (
  <Human seed={props.seed ?? `${props.color}-${(props.position ?? [0, 0, 0]).join(',')}`} {...props} />
);
