import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import type { TariffConfigResponse } from '@shared/types'

export const tariffRouter = Router()

// GET /api/tariff/config — public, no auth required
tariffRouter.get('/config', async (_req, res) => {
  const config = await prisma.tariffConfig.findFirst()
  if (!config) {
    res.status(404).json({ error: 'Tariff config not found. Run prisma db seed.' })
    return
  }

  const response: TariffConfigResponse = {
    rates: config.rates as Record<string, unknown>,
    thresholds: config.thresholds as Record<string, unknown>,
    eeiTable: config.eeiTable as Record<string, unknown>,
    afaRateDefault: config.afaRateDefault
  }
  res.json(response)
})
