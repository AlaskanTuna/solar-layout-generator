import type { PanelModel } from './index'

// widthM = short side, heightM = long side (matches Google Solar API convention)
// costPerWp is panel module cost only; installation multiplier applied at analysis time
export const PANEL_MODELS: PanelModel[] = [
  {
    id: 'google-default',
    name: 'Google Solar API Default',
    manufacturer: 'Google',
    widthM: 1.045,
    heightM: 1.879,
    capacityWp: 400,
    efficiency: 0.204,
    costPerWp: 0
  },
  {
    id: 'jinko-tiger-neo',
    name: 'Jinko Tiger Neo',
    manufacturer: 'Jinko Solar',
    widthM: 1.134,
    heightM: 1.762,
    capacityWp: 440,
    efficiency: 0.2202,
    costPerWp: 2.2
  },
  {
    id: 'longi-himo6',
    name: 'LONGi Hi-MO 6',
    manufacturer: 'LONGi',
    widthM: 1.134,
    heightM: 1.722,
    capacityWp: 430,
    efficiency: 0.22,
    costPerWp: 2.1
  },
  {
    id: 'ja-deepblue4',
    name: 'JA Solar DeepBlue 4.0',
    manufacturer: 'JA Solar',
    widthM: 1.134,
    heightM: 1.762,
    capacityWp: 450,
    efficiency: 0.228,
    costPerWp: 2.3
  },
  {
    id: 'canadian-hihero',
    name: 'Canadian Solar HiHero',
    manufacturer: 'Canadian Solar',
    widthM: 1.134,
    heightM: 1.722,
    capacityWp: 440,
    efficiency: 0.225,
    costPerWp: 2.3
  },
  {
    id: 'trina-vertex-s',
    name: 'Trina Vertex S+',
    manufacturer: 'Trina Solar',
    widthM: 1.134,
    heightM: 1.762,
    capacityWp: 440,
    efficiency: 0.22,
    costPerWp: 2.15
  }
]

export const DEFAULT_PANEL_MODEL_ID = 'jinko-tiger-neo'

export function getPanelModel(id: string): PanelModel | undefined {
  return PANEL_MODELS.find((model) => model.id === id)
}
