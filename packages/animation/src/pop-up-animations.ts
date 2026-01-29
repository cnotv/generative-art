import type { PopUpAnimationConfig, EasingFunction } from './types'

/**
 * Easing functions for animations
 */
export const easing = {
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625
    const d1 = 2.75

    if (t < 1 / d1) {
      return n1 * t * t
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
  },

  easeOutQuad: (t: number): number => {
    return 1 - (1 - t) * (1 - t)
  },

  easeOutBack: (t: number): number => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },

  linear: (t: number): number => t
}

/**
 * Create a pop-up animation with bounce effect
 */
export function createPopUpBounce(config: PopUpAnimationConfig): (frame: number) => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFn = easing.easeOutBounce,
    delay = 0,
    onComplete
  } = config

  let hasCompleted = false

  return (frame: number): boolean => {
    // Handle delay
    if (frame < delay) {
      return true
    }

    const adjustedFrame = frame - delay

    if (adjustedFrame >= duration) {
      if (!hasCompleted) {
        object.position.y = endY
        hasCompleted = true
        onComplete?.()
      }
      return false
    }

    const progress = adjustedFrame / duration
    const easedProgress = easingFn(progress)
    object.position.y = startY + (endY - startY) * easedProgress

    return true
  }
}

/**
 * Create a pop-up animation with fade effect
 */
export function createPopUpFade(config: PopUpAnimationConfig): (frame: number) => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFn = easing.easeOutQuad,
    delay = 0,
    onComplete
  } = config

  // Ensure material is transparent
  if (object.material) {
    object.material.transparent = true
    object.material.opacity = 0
  }

  let hasCompleted = false

  return (frame: number): boolean => {
    if (frame < delay) {
      return true
    }

    const adjustedFrame = frame - delay

    if (adjustedFrame >= duration) {
      if (!hasCompleted) {
        object.position.y = endY
        if (object.material) {
          object.material.opacity = 1
        }
        hasCompleted = true
        onComplete?.()
      }
      return false
    }

    const progress = adjustedFrame / duration
    const easedProgress = easingFn(progress)

    object.position.y = startY + (endY - startY) * easedProgress

    if (object.material) {
      object.material.opacity = easedProgress
    }

    return true
  }
}

/**
 * Create a pop-up animation with scale effect
 */
export function createPopUpScale(config: PopUpAnimationConfig): (frame: number) => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFn = easing.easeOutBack,
    delay = 0,
    onComplete
  } = config

  // Store initial scale
  const initialScale = object.scale.clone()

  // Set initial scale to 0
  object.scale.set(0, 0, 0)

  let hasCompleted = false

  return (frame: number): boolean => {
    if (frame < delay) {
      return true
    }

    const adjustedFrame = frame - delay

    if (adjustedFrame >= duration) {
      if (!hasCompleted) {
        object.position.y = endY
        object.scale.copy(initialScale)
        hasCompleted = true
        onComplete?.()
      }
      return false
    }

    const progress = adjustedFrame / duration
    const easedProgress = easingFn(progress)

    object.position.y = startY + (endY - startY) * easedProgress

    object.scale.set(
      initialScale.x * easedProgress,
      initialScale.y * easedProgress,
      initialScale.z * easedProgress
    )

    return true
  }
}
