import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

type PanelPreview3DProps = {
  widthM: number
  heightM: number
}

function PanelMesh({ widthM, heightM }: { widthM: number; heightM: number }) {
  // Scale down to fit the canvas — normalize so largest dimension is ~1.5
  const scale = 1.5 / Math.max(widthM, heightM)
  const w = widthM * scale
  const h = heightM * scale
  const thickness = 0.06

  return (
    <group rotation={[0.3, 0, 0]}>
      {/* Panel cell surface */}
      <mesh position={[0, 0, thickness / 2]}>
        <boxGeometry args={[w, h, 0.01]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w + 0.04, h + 0.04, thickness]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  )
}

export default function PanelPreview3D({ widthM, heightM }: PanelPreview3DProps) {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 35 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} />
      <PanelMesh widthM={widthM} heightM={heightM} />
      <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} enablePan={false} />
    </Canvas>
  )
}
