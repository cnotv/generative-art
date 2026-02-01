import type { PopUpAnimationConfig } from './types'

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
      return n1 * (t -= 2.625 / d1) * t + 0.984_375
    }
  },

  easeOutQuad: (t: number): number => {
    return 1 - (1 - t) * (1 - t)
  },

  easeOutBack: (t: number): number => {
    const c1 = 1.701_58
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },

  linear: (t: number): number => t
}

/**
 * Create a pop-up animation with bounce effect
 * Returns a function that tracks frames internally and returns false when complete
 */
export function createPopUpBounce(config: PopUpAnimationConfig): () => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFunction = easing.easeOutBounce,
    delay = 0,
    onComplete
  } = config

  let currentFrame = -1
  let hasCompleted = false

  return (): boolean => {
    currentFrame++

    // Handle delay
    if (currentFrame < delay) {
      return true
    }

    const adjustedFrame = currentFrame - delay

    if (adjustedFrame >= duration) {
      if (!hasCompleted) {
        object.position.y = endY
        hasCompleted = true
        onComplete?.()
      }
      return false
    }

    const progress = adjustedFrame / duration
    const easedProgress = easingFunction(progress)
    object.position.y = startY + (endY - startY) * easedProgress

    return true
  }
}

/**
 * Create a pop-up animation with fade effect
 * Returns a function that tracks frames internally and returns false when complete
 */
export function createPopUpFade(config: PopUpAnimationConfig): () => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFunction = easing.easeOutQuad,
    delay = 0,
    onComplete
  } = config

  // Ensure material is transparent
  if ('material' in object && object.material) {
    (object.material as any).transparent = true;
    (object.material as any).opacity = 0
  }

  let currentFrame = -1
  let hasCompleted = false

  return (): boolean => {
    currentFrame++

    if (currentFrame < delay) {
      return true
    }

    const adjustedFrame = currentFrame - delay

    if (adjustedFrame >= duration) {
      if (!hasCompleted) {
        object.position.y = endY
        if ('material' in object && object.material) {
          (object.material as any).opacity = 1
        }
        hasCompleted = true
        onComplete?.()
      }
      return false
    }

    const progress = adjustedFrame / duration
    const easedProgress = easingFunction(progress)

    object.position.y = startY + (endY - startY) * easedProgress

    if ('material' in object && object.material) {
      (object.material as any).opacity = easedProgress
    }

    return true
  }
}

/**
 * Create a pop-up animation with scale effect
 * Returns a function that tracks frames internally and returns false when complete
 */
export function createPopUpScale(config: PopUpAnimationConfig): () => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFunction = easing.easeOutBack,
    delay = 0,
    onComplete
  } = config

  // Store initial scale
  const initialScale = object.scale.clone()

  // Set initial scale to 0
  object.scale.set(0, 0, 0)

  let currentFrame = -1
  let hasCompleted = false

  return (): boolean => {
    currentFrame++

    if (currentFrame < delay) {
      return true
    }

    const adjustedFrame = currentFrame - delay

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
    const easedProgress = easingFunction(progress)

    object.position.y = startY + (endY - startY) * easedProgress

    object.scale.set(
      initialScale.x * easedProgress,
      initialScale.y * easedProgress,
      initialScale.z * easedProgress
    )

    return true
  }
}
