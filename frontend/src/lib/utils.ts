import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind class strings via `clsx` then resolves conflicts with `tailwind-merge`.
 * Standard shadcn helper — last conflicting class wins (e.g. `cn('p-2', 'p-4') === 'p-4'`).
 *
 * @param inputs - Class values: strings, conditionals, arrays, or objects per `clsx` rules
 * @returns Merged className string with Tailwind conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
