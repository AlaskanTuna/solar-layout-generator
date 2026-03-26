import { useMemo, useState } from 'react'
import { MONTHLY_AZIMUTH, MONTHLY_IRRADIANCE } from '@/components/workbench/IrradianceGlow'

export function useIrradiance() {
  const [irradianceMonth, setIrradianceMonth] = useState(new Date().getMonth())

  const irradianceStyle = useMemo(() => {
    const azimuth = MONTHLY_AZIMUTH[irradianceMonth] ?? 180
    const intensity = MONTHLY_IRRADIANCE[irradianceMonth] ?? 0.9
    // Position glow on the container edge: azimuth 0°=N(top), 90°=E(right), 180°=S(bottom)
    const rad = (azimuth * Math.PI) / 180
    const gx = 50 + Math.sin(rad) * 50
    const gy = 50 - Math.cos(rad) * 50
    const alpha = intensity * 0.18
    // Replace the static background-image with a directional amber glow from the sun's position
    return {
      backgroundImage: `radial-gradient(circle at ${gx.toFixed(0)}% ${gy.toFixed(0)}%, rgba(255,184,0,${alpha.toFixed(2)}) 0%, rgba(255,200,50,${(alpha * 0.2).toFixed(3)}) 50%, transparent 55%), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)`
    }
  }, [irradianceMonth])

  return { irradianceMonth, setIrradianceMonth, irradianceStyle }
}
