import type { PanelModel } from './panelTypes.ts'

/**
 * Built-in panel catalog used by the UI and cost model
 */
export const PANEL_MODELS: PanelModel[] = [
  {
    id: 'google-default',
    name: 'Google Solar API Default',
    manufacturer: 'Google',
    widthM: 1.045,
    heightM: 1.879,
    capacityWp: 400,
    efficiency: 0.204,
    costPerWp: 0.95,
    tagline:
      'Generic reference panel from the Solar API. Good for a quick first estimate, but swap to a real model before sharing with an installer.'
  },
  {
    id: 'jinko-tiger-neo',
    name: 'Jinko Tiger Neo',
    manufacturer: 'Jinko Solar',
    widthM: 1.134,
    heightM: 1.762,
    capacityWp: 440,
    efficiency: 0.2202,
    costPerWp: 0.95,
    tagline:
      "Malaysia's most-installed residential panel. N-type TOPCon cells hit a balanced price-to-performance point — a safe default for most roofs."
  },
  {
    id: 'longi-himo6',
    name: 'LONGi Hi-MO 6',
    manufacturer: 'LONGi',
    widthM: 1.134,
    heightM: 1.722,
    capacityWp: 430,
    efficiency: 0.22,
    costPerWp: 1.15,
    tagline:
      'Premium HPBC cell design with strong partial-shade performance. Costs more per Wp but holds resale value and long-term yield.'
  },
  {
    id: 'ja-deepblue4',
    name: 'JA Solar DeepBlue 4.0',
    manufacturer: 'JA Solar',
    widthM: 1.134,
    heightM: 1.762,
    capacityWp: 450,
    efficiency: 0.228,
    costPerWp: 0.98,
    tagline:
      'Highest wattage and efficiency in this lineup (450 Wp, 22.8%). Best pick when roof space is tight and you want maximum output per panel.'
  },
  {
    id: 'canadian-hihero',
    name: 'Canadian Solar HiHero',
    manufacturer: 'Canadian Solar',
    widthM: 1.134,
    heightM: 1.722,
    capacityWp: 440,
    efficiency: 0.225,
    costPerWp: 0.98,
    tagline:
      'HJT cells with strong low-light and high-temperature performance. Good fit for hot, cloudy weather like the Klang Valley.'
  },
  {
    id: 'trina-vertex-s',
    name: 'Trina Vertex S+',
    manufacturer: 'Trina Solar',
    widthM: 1.134,
    heightM: 1.762,
    capacityWp: 440,
    efficiency: 0.22,
    costPerWp: 0.92,
    tagline:
      'Lowest RM/Wp in this lineup from a Tier 1 manufacturer. Pick this when budget is the primary driver and you still want bankable warranties.'
  }
]

/**
 * Default panel model id used for new projects
 */
export const DEFAULT_PANEL_MODEL_ID = 'jinko-tiger-neo'

/**
 * Looks up a panel model by id
 * @param {string} id - Id value
 * @returns {PanelModel} The requested panel model
 */
export function getPanelModel(id: string): PanelModel | undefined {
  return PANEL_MODELS.find((model) => model.id === id)
}
