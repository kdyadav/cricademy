import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'ink',
        'ink-muted',
        'hairline',
        'app',
        'turf',
        'turf-700',
        'turf-600',
        'turf-900',
        'flannel',
        'card',
        'cherry',
        'cherry-soft',
        'gold',
        'clay',
        'gold-soft',
        'mint',
        'mint-strong',
      ],
    },
  },
})

type ClassValue = string | false | null | undefined | Record<string, boolean | undefined>

/** Merge conditional Tailwind classes, resolving conflicts (last wins). */
export function cn(...inputs: ClassValue[]): string {
  const flat = inputs.flatMap((input) => {
    if (!input) return []
    if (typeof input === 'string') return [input]
    return Object.entries(input)
      .filter(([, on]) => on)
      .map(([cls]) => cls)
  })
  return twMerge(flat.join(' '))
}
