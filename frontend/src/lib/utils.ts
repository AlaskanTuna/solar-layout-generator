import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Defines the cn function
 * @param {ClassValue[]} inputs - Inputs used for the calculation
 * @returns {string} The resulting cn value
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
