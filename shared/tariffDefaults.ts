/**
 * Fallback tariff and sizing defaults used when database seed data is missing.
 *
 * The tariff config endpoint normally returns values seeded from the database;
 * these defaults exist so the frontend can still render a reasonable estimate
 * if the seed step has not been run (e.g. a fresh local environment).
 */

/**
 * Default tariff assumptions used when seed data is missing.
 *
 * - `nemCapSinglePhaseKw` / `nemCapThreePhaseKw` — Tariff Rakyat AC capacity
 *   limits (kW) for single-phase and three-phase residential connections.
 * - `systemCostPerKwp` — fallback RM/kWp installed cost when the cost model
 *   has not been computed.
 * - `annualYieldPerKwp` — fallback annual generation (kWh/kWp) for Klang
 *   Valley conditions when flux sampling is unavailable.
 */
export type TariffDefaults = {
  nemCapSinglePhaseKw: number
  nemCapThreePhaseKw: number
  systemCostPerKwp: number
  annualYieldPerKwp: number
}

/** Fallback tariff defaults shared by the backend and frontend. */
export const tariffDefaults: TariffDefaults = {
  nemCapSinglePhaseKw: 5,
  nemCapThreePhaseKw: 12.5,
  systemCostPerKwp: 4500,
  annualYieldPerKwp: 1200
}
