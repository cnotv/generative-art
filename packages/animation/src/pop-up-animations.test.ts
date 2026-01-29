import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import { createPopUpBounce, createPopUpFade, createPopUpScale, easing } from './pop-up-animations'
import type { PopUpAnimationConfig } from './types'

describe('PopUp Animations', () => {
  let object: THREE.Mesh

  beforeEach(() => {
    object = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    )
    object.position.set(0, 0, 0)
    object.scale.set(1, 1, 1)
    object.material.opacity = 1
  })

  describe('createPopUpBounce', () => {
    it('should create an action that animates Y position with bounce', () => {
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 5,
        duration: 10
      }

      const action = createPopUpBounce(config)

      expect(action).toBeDefined()
      expect(typeof action).toBe('function')
    })

    it('should animate from startY to endY over duration', () => {
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 10,
        duration: 10
      }

      const action = createPopUpBounce(config)

      // Start position
      object.position.y = config.startY

      // Simulate animation frames
      for (let frame = 0; frame <= config.duration; frame++) {
        const result = action(frame)
        if (frame === config.duration) {
          expect(result).toBe(false) // Animation complete
          expect(object.position.y).toBeCloseTo(config.endY, 1)
        } else if (frame > 0) {
          expect(result).toBe(true) // Still animating
          expect(object.position.y).toBeGreaterThan(config.startY)
        }
      }
    })

    it('should call onComplete when animation finishes', () => {
      const onComplete = vi.fn()
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 5,
        duration: 5,
        onComplete
      }

      const action = createPopUpBounce(config)

      // Run through animation
      for (let frame = 0; frame <= config.duration; frame++) {
        action(frame)
      }

      expect(onComplete).toHaveBeenCalledOnce()
    })

    it('should respect delay before starting animation', () => {
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 5,
        duration: 5,
        delay: 3
      }

      const action = createPopUpBounce(config)

      object.position.y = config.startY

      // During delay, position should not change
      action(0)
      expect(object.position.y).toBe(config.startY)
      action(2)
      expect(object.position.y).toBe(config.startY)

      // After delay, animation starts
      action(4) // Frame 4 = delay (3) + 1 frame of animation
      expect(object.position.y).toBeGreaterThan(config.startY)
    })
  })

  describe('createPopUpFade', () => {
    it('should animate opacity and position', () => {
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 5,
        duration: 10
      }

      const action = createPopUpFade(config)

      // Set initial opacity
      object.material.opacity = 0
      object.material.transparent = true

      // Simulate animation
      for (let frame = 0; frame <= config.duration; frame++) {
        action(frame)
        if (frame === 0) {
          expect(object.material.opacity).toBeCloseTo(0, 1)
        } else if (frame === config.duration) {
          expect(object.material.opacity).toBeCloseTo(1, 1)
          expect(object.position.y).toBeCloseTo(config.endY, 1)
        }
      }
    })

    it('should set material to transparent', () => {
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 5,
        duration: 5
      }

      const action = createPopUpFade(config)
      action(0)

      expect(object.material.transparent).toBe(true)
    })
  })

  describe('createPopUpScale', () => {
    it('should animate scale from 0 to 1', () => {
      const config: PopUpAnimationConfig = {
        object,
        startY: 0,
        endY: 5,
        duration: 10
      }

      const action = createPopUpScale(config)

      // Simulate animation
      for (let frame = 0; frame <= config.duration; frame++) {
        action(frame)
        if (frame === 0) {
          expect(object.scale.x).toBeCloseTo(0, 1)
          expect(object.scale.y).toBeCloseTo(0, 1)
          expect(object.scale.z).toBeCloseTo(0, 1)
        } else if (frame === config.duration) {
          expect(object.scale.x).toBeCloseTo(1, 1)
          expect(object.scale.y).toBeCloseTo(1, 1)
          expect(object.scale.z).toBeCloseTo(1, 1)
          expect(object.position.y).toBeCloseTo(config.endY, 1)
        }
      }
    })
  })

  describe('easing functions', () => {
    it('should have easeOutBounce function', () => {
      expect(easing.easeOutBounce).toBeDefined()
      expect(typeof easing.easeOutBounce).toBe('function')

      // Test boundary values
      expect(easing.easeOutBounce(0)).toBe(0)
      expect(easing.easeOutBounce(1)).toBeCloseTo(1, 1)
    })

    it('should have easeOutQuad function', () => {
      expect(easing.easeOutQuad).toBeDefined()
      expect(typeof easing.easeOutQuad).toBe('function')

      expect(easing.easeOutQuad(0)).toBe(0)
      expect(easing.easeOutQuad(1)).toBe(1)
    })

    it('should have easeOutBack function', () => {
      expect(easing.easeOutBack).toBeDefined()
      expect(typeof easing.easeOutBack).toBe('function')

      expect(easing.easeOutBack(0)).toBeCloseTo(0, 10)
      expect(easing.easeOutBack(1)).toBeCloseTo(1, 1)
    })
  })
})
