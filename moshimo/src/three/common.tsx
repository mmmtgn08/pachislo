import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {rnd} from '../lib';

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

/** 低ポリの人 */
export const Person: React.FC<{
  color?: string;
  position?: [number, number, number];
  rotationY?: number;
  headShake?: number;
  bounce?: number;
  armUp?: number;
  scale?: number;
}> = ({color = '#3b82f6', position = [0, 0, 0], rotationY = 0, headShake = 0, bounce = 0, armUp = 0, scale = 1}) => (
  <group position={[position[0], position[1] + bounce, position[2]]} rotation={[0, rotationY, 0]} scale={scale}>
    <mesh position={[0, 1.1, 0]}>
      <capsuleGeometry args={[0.38, 0.7, 6, 12]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
    <mesh position={[-0.17, 0.35, 0]}>
      <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
      <meshStandardMaterial color="#1f2937" flatShading />
    </mesh>
    <mesh position={[0.17, 0.35, 0]}>
      <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
      <meshStandardMaterial color="#1f2937" flatShading />
    </mesh>
    <group position={[-0.5, 1.4, 0]} rotation={[0, 0, -0.3 - armUp * 2.2]}>
      <mesh position={[0, -0.3, 0]}>
        <capsuleGeometry args={[0.11, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
    <group position={[0.5, 1.4, 0]} rotation={[0, 0, 0.3 + armUp * 2.2]}>
      <mesh position={[0, -0.3, 0]}>
        <capsuleGeometry args={[0.11, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
    <group position={[0, 2.05, 0]} rotation={[0, 0, headShake]}>
      <mesh>
        <icosahedronGeometry args={[0.42, 2]} />
        <meshStandardMaterial color="#fcd9b6" flatShading />
      </mesh>
      <mesh position={[-0.15, 0.05, 0.37]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[0.15, 0.05, 0.37]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[-0.42, 0, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#f5b997" flatShading />
      </mesh>
      <mesh position={[0.42, 0, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#f5b997" flatShading />
      </mesh>
      <mesh position={[0, 0.25, -0.05]} scale={[1, 0.55, 1]}>
        <icosahedronGeometry args={[0.44, 1]} />
        <meshStandardMaterial color="#3f2a1d" flatShading />
      </mesh>
    </group>
  </group>
);
