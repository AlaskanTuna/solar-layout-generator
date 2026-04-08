const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 2
})

const numberFormatter = new Intl.NumberFormat('en-MY', {
  maximumFractionDigits: 1
})

export function formatCurrency(value: number | null) {
  return value === null ? 'N/A' : currencyFormatter.format(value)
}

export function formatNumber(value: number | null, unit = '') {
  if (value === null) return 'N/A'
  return `${numberFormatter.format(value)}${unit ? ` ${unit}` : ''}`
}

export function formatTooltipCurrency(value: unknown) {
  if (typeof value === 'number') {
    return formatCurrency(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? formatCurrency(parsed) : value
  }

  return 'N/A'
}

export const BILL_TOOLTIPS: Record<string, string> = {
  energy: "The base electricity charge, calculated from your kWh usage at TNB's tiered rates.",
  capacity: 'A fixed charge based on your connection capacity, applied to usage above 600 kWh.',
  network: 'Covers the cost of maintaining the electricity grid that delivers power to your home.',
  retail: 'An additional surcharge applied to usage above 600 kWh.',
  afa: 'Automatic Fuel Adjustment — a government-set surcharge (or rebate) that reflects fuel cost changes.',
  eeiRebate: 'Energy Efficiency Incentive — a rebate that rewards lower electricity consumption.',
  reFund: "Renewable Energy Fund — a 1.6% levy that funds Malaysia's renewable energy development.",
  sst: 'Sales and Service Tax (8%) — applies only when monthly usage exceeds 600 kWh.'
}

export const NEM_TOOLTIPS: Record<string, string> = {
  billableKwh: 'Your consumption minus solar generation — this is what TNB actually charges you for.',
  creditUsed: "Excess solar credits from previous months applied to reduce this month's bill.",
  creditBalance: "Unused solar credits carried forward to offset future months' bills.",
  creditForfeited: 'Credits that expired at year-end (December) — NEM credits cannot be carried into the next year.'
}
