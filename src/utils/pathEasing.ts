import type { EasingName } from '@/components/ui/bezier-picker'

export type { EasingName }

/**
 * Returns a speed multiplier for the given easing preset based on overall
 * path progress t ∈ [0, 1]. The raw value is blended with 1.0 (no easing)
 * by the intensity factor ≥ 0 so intensity=0 → constant speed,
 * intensity=1 → full effect, intensity>1 → amplified effect.
 * @param t - Normalised path progress in [0, 1]
 * @param easing - Named easing curve
 * @param intensity - Blend factor (default 1)
 * @returns Speed multiplier to apply to the base follow speed
 */
export const pathGetEasingMultiplier = (
  t: number,
  easing: EasingName,
  intensity: number = 1
): number => {
  const tc = Math.max(0, Math.min(1, t))
  const it = Math.max(0, intensity)
  const raw = (() => {
    switch (easing) {
      case 'ease-in':
        return 0.4 + 1.2 * tc
      case 'ease-out':
        return 1.6 - 1.2 * tc
      case 'ease-in-out':
        return 1 - 0.6 * Math.cos(Math.PI * tc)
      case 'ease-in-back':
        return 0.4 + 0.8 * tc * tc
      case 'ease-out-back':
        return 1.2 - 0.8 * (1 - tc) * (1 - tc)
      default:
        return 1
    }
  })()
  return 1 + (raw - 1) * it
}
