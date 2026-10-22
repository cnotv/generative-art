import { describe, it, expect } from 'vitest'
import { effect } from 'vue'
import * as THREE from 'three'
import { createLiveConfig } from './heroLook'

describe('createLiveConfig', () => {
  it('shows an edit in what the panel reads, and writes it through to the scene', () => {
    // Arrange
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9 })
    const config = createLiveConfig(
      'Logo',
      { roughness: {} },
      () => material.roughness,
      (_, value) => (material.roughness = value as number)
    )
    const seen: unknown[] = []
    effect(() => seen.push(config.getValue('roughness')))

    // Act
    config.updateValue('roughness', 0.3)

    // Assert
    expect(seen).toEqual([0.9, 0.3])
    expect(material.roughness).toBe(0.3)
  })
})
