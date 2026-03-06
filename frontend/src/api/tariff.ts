import { apiFetch } from './client'
import type { TariffConfigResponse } from '@shared/types'

export function getTariffConfig() {
  return apiFetch<TariffConfigResponse>('/tariff/config')
}
