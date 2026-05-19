/**
 * Tariff API client.
 *
 * Fetches the Malaysian NEM tariff config seeded in the database (rates,
 * thresholds, EEI rebate table, AFA default, effective date). Used by the
 * analysis page to populate the NEM billing simulation.
 */

import { apiFetch } from './client'
import type { TariffConfigResponse } from '@shared/types'

/** Fetches the active tariff configuration (rates, thresholds, EEI table). */
export function getTariffConfig() {
  return apiFetch<TariffConfigResponse>('/tariff/config')
}
