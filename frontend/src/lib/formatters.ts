const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 2
})

const numberFormatter = new Intl.NumberFormat('en-MY', {
  maximumFractionDigits: 1
})

/**
 * Formats a value as Malaysian Ringgit (`RM 1,234.56`). Returns `'N/A'` for `null`.
 *
 * @param value - Amount in MYR, or `null` for unavailable data
 * @returns Locale-aware MYR string or `'N/A'`
 */
export function formatCurrency(value: number | null) {
  return value === null ? 'N/A' : currencyFormatter.format(value)
}

/**
 * Formats a number with the active locale's thousands separator and an optional unit suffix.
 *
 * @param value - Number to format, or `null` for unavailable data
 * @param unit - Optional unit appended after a single space (e.g. `'kWh'`)
 * @returns Formatted number, or `'N/A'` when `value` is null
 */
export function formatNumber(value: number | null, unit = '') {
  if (value === null) return 'N/A'
  return `${numberFormatter.format(value)}${unit ? ` ${unit}` : ''}`
}

/**
 * Recharts tooltip formatter that coerces unknown payload values into MYR strings.
 * Recharts passes tooltip values as `number | string`; this guards both shapes.
 *
 * @param value - Raw value from a Recharts tooltip payload entry
 * @returns MYR-formatted string, the original string when not numeric, or `'N/A'`
 */
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

/** TNB bill component descriptions used as tooltip text in the analysis breakdown. */
export const BILL_TOOLTIPS: Record<string, string> = {
  energy: "The base electricity charge, calculated from your kWh usage at TNB's tiered rates.",
  capacity: 'A fixed charge based on your connection capacity, applied to usage above 600 kWh.',
  network: 'Covers the cost of maintaining the electricity grid that delivers power to your home.',
  retail: 'An additional surcharge applied to usage above 600 kWh.',
  afa: 'Automatic Fuel Adjustment: a government-set surcharge (or rebate) that reflects fuel cost changes.',
  eeiRebate: 'Energy Efficiency Incentive: a rebate that rewards lower electricity consumption.',
  reFund: "Renewable Energy Fund: a 1.6% levy that funds Malaysia's renewable energy development.",
  sst: 'Sales and Service Tax (8%), applied only when monthly usage exceeds 600 kWh.'
}

/** NEM credit-flow descriptions used as tooltip text in the analysis breakdown. */
export const NEM_TOOLTIPS: Record<string, string> = {
  billableKwh: 'Your consumption minus solar generation. This is what TNB actually charges you for.',
  creditUsed: "Excess solar credits from previous months applied to reduce this month's bill.",
  creditBalance: "Unused solar credits carried forward to offset future months' bills.",
  creditForfeited: 'Credits that expired at year-end (December). NEM credits cannot be carried into the next year.'
}
