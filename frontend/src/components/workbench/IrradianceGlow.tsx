import { useMemo } from 'react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Monthly solar irradiance factors for Malaysia (normalized, 1.0 = average)
// Based on typical GHI data for ~3°N latitude
/**
 * Defines the MONTHLY_IRRADIANCE constant
 */
export const MONTHLY_IRRADIANCE = [
  0.85, // Jan — monsoon
  0.9, // Feb — monsoon tail
  1.05, // Mar — hot dry
  1.1, // Apr — peak
  1.1, // May — peak
  1.05, // Jun
  1.0, // Jul
  0.95, // Aug
  0.95, // Sep
  0.9, // Oct — monsoon onset
  0.8, // Nov — northeast monsoon
  0.8 // Dec — monsoon
]

// Sun azimuth approximation for Malaysia by month (degrees from North, clockwise)
// At 3°N, the sun is slightly south most of the year, crossing north briefly around equinoxes
/**
 * Defines the MONTHLY_AZIMUTH constant
 */
export const MONTHLY_AZIMUTH = [
  180, // Jan — south
  170, // Feb — slightly south
  160, // Mar — transitioning
  140, // Apr — more overhead
  120, // May — slightly north
  90, // Jun — north-ish (sun is north of equator)
  90, // Jul — north
  120, // Aug — transitioning back
  150, // Sep — near equinox
  170, // Oct — south
  180, // Nov — south
  180 // Dec — south
]

/**
 * Re-exports shared helpers
 */
export { MONTH_LABELS }

type IrradianceGlowProps = {
  month: number
}

/**
 * Renders the IrradianceGlow component
 * @param {IrradianceGlowProps} props - Props for the component
 */
export function IrradianceGlow({ month }: IrradianceGlowProps) {
  const style = useMemo(() => {
    const azimuth = MONTHLY_AZIMUTH[month] ?? 180
    const intensity = MONTHLY_IRRADIANCE[month] ?? 0.9

    // Convert azimuth to a CSS gradient position for north-up satellite imagery
    // 0° maps to top, 90° to right, 180° to bottom, and 270° to left
    const rad = ((azimuth - 90) * Math.PI) / 180
    const gx = 50 + Math.cos(rad) * 50
    const gy = 50 + Math.sin(rad) * 50
    const opacity = intensity * 0.42

    return {
      background: `radial-gradient(ellipse at ${gx.toFixed(1)}% ${gy.toFixed(1)}%, rgba(255, 184, 0, ${opacity.toFixed(3)}) 0%, rgba(255, 184, 0, ${(opacity * 0.45).toFixed(3)}) 40%, transparent 70%)`
    }
  }, [month])

  return <div className="pointer-events-none absolute inset-0 z-[5] rounded-2xl" style={style} />
}
