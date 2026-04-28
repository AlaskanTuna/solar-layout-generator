import type { PanelEdit } from '@shared/types'

/**
 * Defines the BoundingBox type
 */
export type BoundingBox = {
  sw: { latitude: number; longitude: number }
  ne: { latitude: number; longitude: number }
}

/**
 * Defines the RoofSegment type
 */
export type RoofSegment = {
  azimuthDegrees: number
  pitchDegrees: number
}

/**
 * Defines the SolarPanel type
 */
export type SolarPanel = {
  id: string
  center: { lat: number; lng: number }
  orientation: 'PORTRAIT' | 'LANDSCAPE'
  yearlyEnergyDcKwh: number
  segmentIndex: number
}

/**
 * Defines the ParsedBuildingInsights type
 */
export type ParsedBuildingInsights = {
  boundingBox: BoundingBox
  solarPotential: {
    panelWidthMeters: number
    panelHeightMeters: number
    panelCapacityWatts: number
    maxArrayPanelsCount: number
    carbonOffsetFactorKgPerMwh: number
    panelLifetimeYears: number | null
    roofSegmentStats: RoofSegment[]
    solarPanels: SolarPanel[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function getCoordinate(raw: unknown): {
  latitude: number
  longitude: number
} | null {
  if (!isRecord(raw)) return null

  const latitude = getNumber(raw.latitude)
  const longitude = getNumber(raw.longitude)

  if (latitude === null || longitude === null) {
    return null
  }

  return { latitude, longitude }
}

function getPanelCenter(raw: unknown): { lat: number; lng: number } | null {
  if (!isRecord(raw)) return null

  const latitude = getNumber(raw.latitude) ?? getNumber(raw.lat)
  const longitude = getNumber(raw.longitude) ?? getNumber(raw.lng)

  if (latitude === null || longitude === null) {
    return null
  }

  return { lat: latitude, lng: longitude }
}

/**
 * Defines the parseBuildingInsights function
 * @param {unknown} raw - Value used for raw
 * @returns {ParsedBuildingInsights} The parsed building insights
 */
export function parseBuildingInsights(raw: unknown): ParsedBuildingInsights | null {
  if (!isRecord(raw)) return null

  const boundingBoxRaw = raw.boundingBox
  const solarPotentialRaw = raw.solarPotential

  if (!isRecord(boundingBoxRaw) || !isRecord(solarPotentialRaw)) {
    return null
  }

  const sw = getCoordinate(boundingBoxRaw.sw)
  const ne = getCoordinate(boundingBoxRaw.ne)

  const panelWidthMeters = getNumber(solarPotentialRaw.panelWidthMeters)
  const panelHeightMeters = getNumber(solarPotentialRaw.panelHeightMeters)
  const panelCapacityWatts = getNumber(solarPotentialRaw.panelCapacityWatts)

  if (!sw || !ne || panelWidthMeters === null || panelHeightMeters === null || panelCapacityWatts === null) {
    return null
  }

  const roofSegmentStats = Array.isArray(solarPotentialRaw.roofSegmentStats)
    ? solarPotentialRaw.roofSegmentStats
        .map((segment) => {
          if (!isRecord(segment)) return null
          const azimuthDegrees = getNumber(segment.azimuthDegrees)
          const pitchDegrees = getNumber(segment.pitchDegrees) ?? 0
          return azimuthDegrees === null ? null : { azimuthDegrees, pitchDegrees }
        })
        .filter((segment): segment is RoofSegment => segment !== null)
    : []

  const solarPanels = Array.isArray(solarPotentialRaw.solarPanels)
    ? solarPotentialRaw.solarPanels
        .map((panel) => {
          if (!isRecord(panel)) return null

          const id = getString(panel.id)
          const center = getPanelCenter(panel.center)
          const orientation = panel.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE'
          const yearlyEnergyDcKwh = getNumber(panel.yearlyEnergyDcKwh)
          const segmentIndex = getNumber(panel.segmentIndex)

          if (!id || !center || yearlyEnergyDcKwh === null || segmentIndex === null) {
            return null
          }

          return {
            id,
            center,
            orientation,
            yearlyEnergyDcKwh,
            segmentIndex
          } satisfies SolarPanel
        })
        .filter((panel): panel is SolarPanel => panel !== null)
    : []

  return {
    boundingBox: { sw, ne },
    solarPotential: {
      panelWidthMeters,
      panelHeightMeters,
      panelCapacityWatts,
      maxArrayPanelsCount: getNumber(solarPotentialRaw.maxArrayPanelsCount) ?? solarPanels.length,
      carbonOffsetFactorKgPerMwh: getNumber(solarPotentialRaw.carbonOffsetFactorKgPerMwh) ?? 0,
      panelLifetimeYears: getNumber(solarPotentialRaw.panelLifetimeYears),
      roofSegmentStats,
      solarPanels
    }
  }
}

/**
 * Defines the parsePanelEdits function
 * @param {unknown} raw - Value used for raw
 * @returns {Array} The parsed panel edits
 */
export function parsePanelEdits(raw: unknown): PanelEdit[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!isRecord(item)) return null

      const id = getString(item.id)
      const status = item.status === 'kept' || item.status === 'moved' || item.status === 'deleted' ? item.status : null
      const center = getPanelCenter(item.center)
      const rotation = getNumber(item.rotation)
      const monthlyEnergyDcKwh = Array.isArray(item.monthlyEnergyDcKwh)
        ? item.monthlyEnergyDcKwh.map(getNumber).filter((value): value is number => value !== null)
        : []

      if (!id || !status || !center || rotation === null) {
        return null
      }

      return {
        id,
        status,
        center,
        rotation,
        monthlyEnergyDcKwh
      } satisfies PanelEdit
    })
    .filter((item): item is PanelEdit => item !== null)
}

/**
 * Defines the normalizeRotation function
 * @param {number} rotation - Value used for rotation
 * @returns {number} The normalized rotation
 */
export function normalizeRotation(rotation: number): number {
  const normalized = rotation % 360
  return normalized < 0 ? normalized + 360 : normalized
}

/**
 * Computes the initial panel rotation value
 * @param {SolarPanel} panel - Value used for panel
 * @param {RoofSegment[]} roofSegments - Collection of roof segments values
 * @returns {number} The requested initial panel rotation
 */
export function getInitialPanelRotation(panel: SolarPanel, roofSegments: RoofSegment[]): number {
  const orientationDegrees = panel.orientation === 'PORTRAIT' ? 90 : 0
  const azimuthDegrees = roofSegments[panel.segmentIndex]?.azimuthDegrees ?? 0

  // Match prototype's image-space rotation where Y grows downward
  return normalizeRotation(azimuthDegrees + orientationDegrees - 90)
}

/**
 * Defines the annualEnergyFromMonthly function
 * @param {number[]} monthlyEnergyDcKwh - Collection of monthly energy dc kwh values
 * @returns {number} The resulting annual energy from monthly value
 */
export function annualEnergyFromMonthly(monthlyEnergyDcKwh: number[]): number {
  return monthlyEnergyDcKwh.reduce((sum, value) => sum + value, 0)
}
