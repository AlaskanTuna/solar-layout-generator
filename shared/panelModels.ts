import type { PanelModel } from './index'

export const PANEL_MODELS: PanelModel[] = [
  {
    id: 'google-default',
    name: 'Google Solar API Default',
    manufacturer: 'Google',
    widthM: 1.65,
    heightM: 0.99,
    capacityWp: 250,
    efficiency: 0.153,
    costPerWp: 0
  },
  {
    id: 'jinko-tiger-neo',
    name: 'Jinko Tiger Neo',
    manufacturer: 'Jinko Solar',
    widthM: 1.762,
    heightM: 1.134,
    capacityWp: 440,
    efficiency: 0.2202,
    costPerWp: 2.2
  },
  {
    id: 'longi-himo6',
    name: 'LONGi Hi-MO 6',
    manufacturer: 'LONGi',
    widthM: 1.722,
    heightM: 1.134,
    capacityWp: 430,
    efficiency: 0.22,
    costPerWp: 2.1
  },
  {
    id: 'ja-deepblue4',
    name: 'JA Solar DeepBlue 4.0',
    manufacturer: 'JA Solar',
    widthM: 1.762,
    heightM: 1.134,
    capacityWp: 450,
    efficiency: 0.228,
    costPerWp: 2.3
  },
  {
    id: 'trina-vertex-s',
    name: 'Trina Vertex S+',
    manufacturer: 'Trina Solar',
    widthM: 1.762,
    heightM: 1.134,
    capacityWp: 440,
    efficiency: 0.22,
    costPerWp: 2.15
  }
]

export const DEFAULT_PANEL_MODEL_ID = 'jinko-tiger-neo'

export function getPanelModel(id: string): PanelModel | undefined {
  return PANEL_MODELS.find((model) => model.id === id)
}
