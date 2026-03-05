import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

async function main() {
  // Upsert RP4 tariff config — idempotent
  await prisma.tariffConfig.upsert({
    where: { tariffVersion: 'RP4-2025' },
    update: {
      rates: RATES,
      thresholds: THRESHOLDS,
      eeiTable: EEI_TABLE,
      afaRateDefault: -2.77
    },
    create: {
      tariffVersion: 'RP4-2025',
      rates: RATES,
      thresholds: THRESHOLDS,
      eeiTable: EEI_TABLE,
      afaRateDefault: -2.77
    }
  })

  console.log('Seeded RP4 tariff config')
}

// Malaysian RP4 tariff rates (sen/kWh unless noted)
const RATES = {
  energyLow: 27.03, // <= 1500 kWh
  energyHigh: 37.03, // > 1500 kWh
  capacity: 4.55,
  network: 12.85,
  retailChargeRm: 10.0, // RM/month (not sen)
  sstRate: 0.08, // 8%
  reFundRate: 0.016, // 1.6%
  minChargeRm: 3.0
}

const THRESHOLDS = {
  energyCliff: 1500, // kWh — rate boundary
  retailWaiver: 600, // kWh — below this, no retail charge
  afaWaiver: 600, // kWh — below this, AFA = 0
  sstExemption: 600, // kWh — below this, SST = 0
  eeiCutoff: 1000, // kWh — above this, no EEI rebate
  reFundExemption: 300 // kWh — below this, no RE Fund
}

// EEI lookup: [upperBoundKwh, rebateSenPerKwh]
// Source: Knowledge Vault (MVP-PAGE-3-KNOWLEDGE-VAULT.md)
const EEI_TABLE = [
  [200, 25.0],
  [250, 24.5],
  [300, 22.5],
  [350, 21.0],
  [400, 17.0],
  [450, 14.5],
  [500, 12.0],
  [550, 10.5],
  [600, 9.0],
  [650, 7.5],
  [700, 5.5],
  [750, 4.5],
  [800, 4.0],
  [850, 2.5],
  [900, 1.0],
  [1000, 0.5]
]

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
