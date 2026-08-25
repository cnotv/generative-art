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

const BACK_OVERSHOOT = 1.70158
const BACK_SCALE = BACK_OVERSHOOT + 1

/** The eased progress each preset describes, before intensity is applied. */
const EASING_CURVES: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  'ease-in-back': (t) => BACK_SCALE * t ** 3 - BACK_OVERSHOOT * t * t,
  'ease-out-back': (t) => 1 + BACK_SCALE * (t - 1) ** 3 + BACK_OVERSHOOT * (t - 1) ** 2
}

/**
 * Remaps progress along a path, for anything driven by a fraction of the way through rather
 * than by a per-frame speed.
 *
 * The companion to `pathGetEasingMultiplier`, which answers the same question for a follower
 * that moves a step at a time. Intensity blends towards linear the same way in both, so a
 * shared control means the same thing whichever is reading it.
 * @param t - Normalised progress in [0, 1]
 * @param easing - Named easing curve
 * @param intensity - Blend factor, 0 for linear and 1 for the full curve (default 1)
 * @returns The eased progress, clamped to [0, 1]
 */
export const pathGetEasingProgress = (
  t: number,
  easing: EasingName,
  intensity: number = 1
): number => {
  const clamped = Math.max(0, Math.min(1, t))
  const eased = (EASING_CURVES[easing] ?? EASING_CURVES.linear)(clamped)
  const blended = clamped + (eased - clamped) * Math.max(0, intensity)
  return Math.max(0, Math.min(1, blended))
}
