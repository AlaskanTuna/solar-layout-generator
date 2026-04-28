import { Router, type Router as ExpressRouter } from 'express'
import { prisma } from '../config/prisma.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { NotFoundError } from '../errors.js'
import { tariffDefaults, type TariffConfigResponse } from '@shared/types'

export const tariffRouter: ExpressRouter = Router()

tariffRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const config = await prisma.tariffConfig.findFirst()
    if (!config) throw new NotFoundError('Tariff config not found. Run prisma db seed.')

    if (!config.defaults) {
      console.warn('[TariffConfig] defaults missing in database row, using inline fallback values')
    }

    const response: TariffConfigResponse = {
      rates: config.rates as TariffConfigResponse['rates'],
      thresholds: config.thresholds as TariffConfigResponse['thresholds'],
      eeiTable: config.eeiTable as TariffConfigResponse['eeiTable'],
      afaRateDefault: config.afaRateDefault,
      defaults: (config.defaults ?? tariffDefaults) as TariffConfigResponse['defaults'],
      effectiveDate: config.effectiveDate ? config.effectiveDate.toISOString() : null,
      sourceNote: config.sourceNote ?? null
    }
    res.json(response)
  })
)
