/**
 * Default tariff assumptions used when seed data is missing
 */
export type TariffDefaults = {
  nemCapSinglePhaseKw: number
  nemCapThreePhaseKw: number
  systemCostPerKwp: number
  annualYieldPerKwp: number
}

/**
 * Fallback tariff defaults shared by the backend
 */
export const tariffDefaults: TariffDefaults = {
  nemCapSinglePhaseKw: 5,
  nemCapThreePhaseKw: 12.5,
  systemCostPerKwp: 4500,
  annualYieldPerKwp: 1200
}
