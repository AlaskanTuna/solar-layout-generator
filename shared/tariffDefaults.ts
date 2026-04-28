export type TariffDefaults = {
  nemCapSinglePhaseKw: number
  nemCapThreePhaseKw: number
  systemCostPerKwp: number
  annualYieldPerKwp: number
}

export const tariffDefaults: TariffDefaults = {
  nemCapSinglePhaseKw: 5,
  nemCapThreePhaseKw: 12.5,
  systemCostPerKwp: 4500,
  annualYieldPerKwp: 1200
}
