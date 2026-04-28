import { useMemo, useState } from 'react'
import { MONTHLY_AZIMUTH, MONTHLY_IRRADIANCE } from '@/components/workbench/IrradianceGlow'

/**
 * Provides the irradiance hook
 * @returns {Object} Hook state for irradiance
 */
export function useIrradiance() {
  const [irradianceMonth, setIrradianceMonth] = useState(new Date().getMonth())

  const irradianceStyle = useMemo(() => {
    const azimuth = MONTHLY_AZIMUTH[irradianceMonth] ?? 180
    const intensity = MONTHLY_IRRADIANCE[irradianceMonth] ?? 0.9
    // Position glow at container edge based on azimuth
    const rad = (azimuth * Math.PI) / 180
    const gx = 50 + Math.sin(rad) * 50
    const gy = 50 - Math.cos(rad) * 50
    const alpha = intensity * 0.34
    // Directional amber glow from sun position
    return {
      backgroundImage: `radial-gradient(circle at ${gx.toFixed(0)}% ${gy.toFixed(0)}%, rgba(255,176,0,${alpha.toFixed(2)}) 0%, rgba(255,200,50,${(alpha * 0.55).toFixed(3)}) 35%, rgba(255,215,90,${(alpha * 0.18).toFixed(3)}) 60%, transparent 78%), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)`
    }
  }, [irradianceMonth])

  return { irradianceMonth, setIrradianceMonth, irradianceStyle }
}
