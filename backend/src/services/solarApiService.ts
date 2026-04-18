import { env } from '../config/env.js'

const BASE_URL = 'https://solar.googleapis.com/v1'

export async function fetchBuildingInsights(lat: number, lng: number) {
  const params = new URLSearchParams({
    'location.latitude': lat.toString(),
    'location.longitude': lng.toString(),
    requiredQuality: 'HIGH',
    key: env.GOOGLE_API_KEY
  })

  const response = await fetch(`${BASE_URL}/buildingInsights:findClosest?${params}`)
  if (!response.ok) {
    throw new Error(`Solar API error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

export async function fetchDataLayers(lat: number, lng: number, radiusMeters: number) {
  const params = new URLSearchParams({
    'location.latitude': lat.toString(),
    'location.longitude': lng.toString(),
    radiusMeters: radiusMeters.toString(),
    view: 'FULL_LAYERS',
    requiredQuality: 'HIGH',
    key: env.GOOGLE_API_KEY
  })

  const response = await fetch(`${BASE_URL}/dataLayers:get?${params}`)
  if (!response.ok) {
    throw new Error(`DataLayers error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

export function calculateRadius(bbox: {
  sw: { latitude: number; longitude: number }
  ne: { latitude: number; longitude: number }
}): number {
  const diameter = haversineDistance(bbox.sw.latitude, bbox.sw.longitude, bbox.ne.latitude, bbox.ne.longitude)
  return Math.ceil(diameter / 2) + 10
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dPhi = ((lat2 - lat1) * Math.PI) / 180
  const dLambda = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enrichBuildingInsights(insights: any): any {
  const panels = insights.solarPotential?.solarPanels ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = panels.map((panel: any, idx: number) => ({
    ...panel,
    id: `panel_${idx}`
  }))
  return {
    ...insights,
    solarPotential: {
      ...insights.solarPotential,
      solarPanels: enriched
    }
  }
}
