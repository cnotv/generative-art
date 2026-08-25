import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import { createLightTransitionPlayer } from './lightTransition'

type FrameCallback = (timestamp: number) => void

describe('createLightTransitionPlayer', () => {
  let frameCallbacks: FrameCallback[] = []

  beforeEach(() => {
    frameCallbacks = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
      frameCallbacks = [...frameCallbacks, callback]
      return frameCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Run the pending frame at a timestamp, as the browser would. */
  const advance = (timestamp: number) => {
    const pending = frameCallbacks
    frameCallbacks = []
    pending.forEach((callback) => callback(timestamp))
  }

  const setup = () => {
    const scene = new THREE.Scene()
    const onStop = vi.fn()
    const player = createLightTransitionPlayer({
      threeScene: ref(scene),
      onStart: vi.fn(),
      onStop
    })
    return { scene, player, onStop }
  }

  it('lights the scene on every frame while playing', () => {
    const { scene, player } = setup()

    player.setEnabled(true)
    advance(performance.now() + 100)

    expect(scene.getObjectByName('ambient-light')).toBeInstanceOf(THREE.AmbientLight)
    expect(scene.getObjectByName('directional-light')).toBeInstanceOf(THREE.DirectionalLight)
  })

  it('keeps running across many frames without producing an invalid rig', () => {
    const { scene, player } = setup()
    const start = performance.now()

    player.setEnabled(true)
    // Twenty seconds at speed 4 wraps the cycle more than once.
    player.setSpeed(4)
    Array.from({ length: 20 }, (_, index) => start + index * 1000).forEach(advance)

    const ambient = scene.getObjectByName('ambient-light') as THREE.AmbientLight
    expect(Number.isFinite(ambient.intensity)).toBe(true)
  })

  it('hands the settled rig back when stopped', () => {
    const { player, onStop } = setup()

    player.setEnabled(true)
    advance(performance.now() + 100)
    player.setEnabled(false)

    expect(player.enabled.value).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][0]).toHaveProperty('sky.color')
  })
})
