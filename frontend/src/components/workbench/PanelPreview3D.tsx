import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

type PanelPreview3DProps = {
  widthM: number
  heightM: number
  cellColor?: string
}

function PanelMesh({
  widthM,
  heightM,
  cellColor = '#1a2744'
}: {
  widthM: number
  heightM: number
  cellColor?: string
}) {
  const scale = 1.5 / Math.max(widthM, heightM)
  const w = widthM * scale
  const h = heightM * scale
  const cellDepth = 0.008
  const frameDepth = 0.04

  // Create a cell grid texture using Canvas
  const cellTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 512
    const ctx = canvas.getContext('2d')!

    // Base cell color
    ctx.fillStyle = cellColor
    ctx.fillRect(0, 0, 256, 512)

    // Cell grid lines (darker gaps between cells)
    ctx.strokeStyle = '#0a1525'
    ctx.lineWidth = 1.5

    // Horizontal cell lines (6 rows)
    const rows = 6
    for (let i = 1; i < rows; i++) {
      const y = (i / rows) * 512
      ctx.beginPath()
      ctx.moveTo(4, y)
      ctx.lineTo(252, y)
      ctx.stroke()
    }

    // Vertical cell lines (10 columns)
    const cols = 10
    for (let i = 1; i < cols; i++) {
      const x = (i / cols) * 256
      ctx.beginPath()
      ctx.moveTo(x, 4)
      ctx.lineTo(x, 508)
      ctx.stroke()
    }

    // Subtle cell bus bars (thin silver lines down the middle of each cell)
    ctx.strokeStyle = 'rgba(180, 190, 210, 0.15)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) / cols) * 256
      ctx.beginPath()
      ctx.moveTo(x, 4)
      ctx.lineTo(x, 508)
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [cellColor])

  return (
    <group rotation={[0.3, 0, 0]}>
      {/* Aluminum frame (back plate) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w + 0.03, h + 0.03, frameDepth]} />
        <meshStandardMaterial color="#a8a8a8" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Glass + cell surface */}
      <mesh position={[0, 0, frameDepth / 2 + cellDepth / 2]}>
        <boxGeometry args={[w - 0.01, h - 0.01, cellDepth]} />
        <meshStandardMaterial map={cellTexture} roughness={0.15} metalness={0.05} envMapIntensity={0.5} />
      </mesh>
      {/* Slight glass reflection layer */}
      <mesh position={[0, 0, frameDepth / 2 + cellDepth + 0.001]}>
        <boxGeometry args={[w - 0.01, h - 0.01, 0.002]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} roughness={0.0} metalness={0.1} />
      </mesh>
    </group>
  )
}

export default function PanelPreview3D({ widthM, heightM, cellColor }: PanelPreview3DProps) {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 35 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-2, 3, -1]} intensity={0.3} />
      <PanelMesh widthM={widthM} heightM={heightM} cellColor={cellColor} />
      <OrbitControls autoRotate autoRotateSpeed={1.5} enableZoom={false} enablePan={false} />
    </Canvas>
  )
}
