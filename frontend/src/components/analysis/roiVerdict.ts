export type RoiCondition = {
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  color: string
  bgColor: string
  accent: string
  starCount: number
  starColor: string
  description: string
}

export function getRoiCondition(paybackYears: number | null): RoiCondition {
  if (paybackYears === null || paybackYears > 25) {
    return {
      label: 'Poor',
      color: 'text-red-600',
      bgColor: 'bg-red-100 text-red-700',
      accent: 'bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800',
      starCount: 1,
      starColor: 'text-red-500',
      description: 'May not pay back in time'
    }
  }
  if (paybackYears > 12) {
    return {
      label: 'Fair',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 text-amber-700',
      accent: 'bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-800',
      starCount: 3,
      starColor: 'text-amber-500',
      description: 'Moderate return'
    }
  }
  if (paybackYears > 6) {
    return {
      label: 'Good',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 text-emerald-700',
      accent: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800',
      starCount: 4,
      starColor: 'text-emerald-500',
      description: 'Solid return'
    }
  }
  return {
    label: 'Excellent',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 text-emerald-700',
    accent: 'bg-emerald-200 border-emerald-400 dark:bg-emerald-900 dark:border-emerald-700',
    starCount: 5,
    starColor: 'text-emerald-500',
    description: 'Outstanding return'
  }
}
