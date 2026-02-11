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

  // Store initial scale to restore after animation
  const initialScale = object.scale.clone()

  // Start invisible (scale = 0)
  object.scale.set(0, 0, 0)

  let currentFrame = -1
  let hasCompleted = false

  return (): boolean => {
    currentFrame++

    // Handle delay - keep invisible during delay
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

    // Fade in by scaling from 0 to initial scale
    object.scale.set(
      initialScale.x * easedProgress,
      initialScale.y * easedProgress,
      initialScale.z * easedProgress
    )

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

/**
 * Create a slide-in animation from the sides
 * Clouds on left side of screen slide in from left, clouds on right slide in from right
 * Returns a function that tracks frames internally and returns false when complete
 */
export function createSlideInFromSides(config: PopUpAnimationConfig): () => boolean {
  const {
    object,
    startY,
    endY,
    duration,
    easing: easingFunction = easing.easeOutQuad,
    delay = 0,
    onComplete
  } = config

  // Store initial position and scale
  const initialScale = object.scale.clone()
  const endX = object.position.x

  // Determine slide direction based on X position
  // Negative X (left side) slides from left (-), positive X (right side) slides from right (+)
  const slideOffset = endX < 0 ? -300 : 300
  const startX = endX + slideOffset

  // Start invisible (scale = 0)
  object.scale.set(0, 0, 0)
  object.position.x = startX

  let currentFrame = -1
  let hasCompleted = false

  return (): boolean => {
    currentFrame++

    // Handle delay - keep invisible during delay
    if (currentFrame < delay) {
      return true
    }

    const adjustedFrame = currentFrame - delay

    if (adjustedFrame >= duration) {
      if (!hasCompleted) {
        object.position.x = endX
        object.position.y = endY
        object.scale.copy(initialScale)
        hasCompleted = true
        onComplete?.()
      }
      return false
    }

    const progress = adjustedFrame / duration
    const easedProgress = easingFunction(progress)

    // Slide from startX to endX
    object.position.x = startX + (endX - startX) * easedProgress
    object.position.y = startY + (endY - startY) * easedProgress

    // Fade in by scaling from 0 to initial scale
    object.scale.set(
      initialScale.x * easedProgress,
      initialScale.y * easedProgress,
      initialScale.z * easedProgress
    )

    return true
  }
}

/**
 * Sort order functions for sequencing animations
 */
export const sortOrder = {
  /**
   * Sort by Z position (front to back)
   * Items with higher Z (closer to camera) animate first
   */
  zFrontToBack: (a: { position: [number, number, number] }, b: { position: [number, number, number] }): number => {
    return b.position[2] - a.position[2]
  },

  /**
   * Sort by Z position (back to front)
   * Items with lower Z (further from camera) animate first
   */
  zBackToFront: (a: { position: [number, number, number] }, b: { position: [number, number, number] }): number => {
    return a.position[2] - b.position[2]
  },

  /**
   * Sort by X position (left to right)
   */
  xLeftToRight: (a: { position: [number, number, number] }, b: { position: [number, number, number] }): number => {
    return a.position[0] - b.position[0]
  },

  /**
   * Sort by X position (right to left)
   */
  xRightToLeft: (a: { position: [number, number, number] }, b: { position: [number, number, number] }): number => {
    return b.position[0] - a.position[0]
  },

  /**
   * Sort by distance from origin (closest first)
   */
  distanceFromOrigin: (a: { position: [number, number, number] }, b: { position: [number, number, number] }): number => {
    const distributionA = Math.hypot(a.position[0], a.position[1], a.position[2])
    const distributionB = Math.hypot(b.position[0], b.position[1], b.position[2])
    return distributionA - distributionB
  },

  /**
   * Create a sort function that sorts by distance from a specific Z-position
   * Items closer to the target Z position animate first
   * @param items All items to analyze for min/max Z
   * @param target 'start' (min Z), 'middle', or 'end' (max Z)
   */
  byDistanceFromZ: (items: Array<{ position: [number, number, number] }>, target: 'start' | 'middle' | 'end') => {
    // Find min and max Z values
    const zValues = items.map(item => item.position[2])
    const minZ = Math.min(...zValues)
    const maxZ = Math.max(...zValues)

    // Calculate target Z position
    let targetZ: number
    if (target === 'start') {
      targetZ = minZ
    } else if (target === 'end') {
      targetZ = maxZ
    } else {
      targetZ = (minZ + maxZ) / 2
    }

    // Return sort function
    return (a: { position: [number, number, number] }, b: { position: [number, number, number] }): number => {
      const distributionA = Math.abs(a.position[2] - targetZ)
      const distributionB = Math.abs(b.position[2] - targetZ)
      return distributionA - distributionB
    }
  }
}

/**
 * Calculate delays for sequential animation based on sort order
 * @param items Array of items with position data
 * @param sortFn Sort function to determine animation order
 * @param delayIncrement Frames to add between each item (default: 2)
 * @param maxTotalDelay Maximum total delay in frames (default: 60 frames = ~1 second at 60fps)
 * @returns Array of delays in the original item order
 */
export function calculateSequentialDelays<T extends { position: [number, number, number] }>(
  items: T[],
  sortFunction: (a: T, b: T) => number,
  delayIncrement: number = 2,
  maxTotalDelay: number = 60
): number[] {
  // Create array of indices and items
  const indexedItems = items.map((item, index) => ({ item, originalIndex: index }))

  // Sort by the provided sort function
  indexedItems.sort((a, b) => sortFunction(a.item, b.item))

  // Calculate what the delay increment should be to fit within maxTotalDelay
  const maxPossibleDelay = (items.length - 1) * delayIncrement
  const actualDelayIncrement = maxPossibleDelay > maxTotalDelay
    ? maxTotalDelay / (items.length - 1)
    : delayIncrement

  // Calculate delays for sorted items
  const delays = new Array(items.length).fill(0)
  indexedItems.forEach((indexedItem, sortedIndex) => {
    delays[indexedItem.originalIndex] = Math.floor(sortedIndex * actualDelayIncrement)
  })

  return delays
}
