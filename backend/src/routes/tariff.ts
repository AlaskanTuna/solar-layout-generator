import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { TariffConfigResponse } from '@shared/types'

export const tariffRouter = Router()

// GET /api/tariff/config — public, no auth required
tariffRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const config = await prisma.tariffConfig.findFirst()
    if (!config) {
      res.status(404).json({ error: 'Tariff config not found. Run prisma db seed.' })
      return
    }

    if (!config.defaults) {
      console.warn('[TariffConfig] defaults missing in database row, using inline fallback values')
    }

    const response: TariffConfigResponse = {
      rates: config.rates as TariffConfigResponse['rates'],
      thresholds: config.thresholds as TariffConfigResponse['thresholds'],
      eeiTable: config.eeiTable as TariffConfigResponse['eeiTable'],
      afaRateDefault: config.afaRateDefault,
      defaults: (config.defaults ?? {
        nemCapSinglePhaseKw: 5,
        nemCapThreePhaseKw: 12.5,
        systemCostPerKwp: 4500,
        annualYieldPerKwp: 1200
      }) as TariffConfigResponse['defaults']
    }
    res.json(response)
  })
)
