import { describe, it, expect } from 'vitest'
import { followCameraCandidates } from './followCameraPanel'
import type { SceneElement } from '@/stores/debugScene'

const element = (name: string, type: string, extra: Partial<SceneElement> = {}): SceneElement => ({
  name,
  type,
  hidden: false,
  ...extra
})

describe('followCameraCandidates', () => {
  const SCENE: SceneElement[] = [
    element('Camera', 'PerspectiveCamera'),
    element('ambient-light', 'AmbientLight'),
    element('directional-light', 'DirectionalLight'),
    element('ground', 'Mesh'),
    element('sky', 'Mesh'),
    element('player', 'Group'),
    element('crate', 'Mesh')
  ]

  it('offers the things in the scene, not the scene itself', () => {
    expect(followCameraCandidates(SCENE).map((c) => c.value)).toEqual(['player', 'crate'])
  })

  it.each([
    ['Camera', 'PerspectiveCamera'],
    ['Camera', 'OrthographicCamera'],
    ['ambient-light', 'AmbientLight'],
    ['ground', 'Mesh'],
    ['sky', 'Mesh'],
    ['run-camera', 'Rig'],
    ['PathDebug', 'Group']
  ])('leaves out %s (%s), which a camera cannot follow', (name, type) => {
    expect(followCameraCandidates([element(name, type)])).toEqual([])
  })

  it('leaves out texture areas, which are a surface rather than an object', () => {
    expect(
      followCameraCandidates([element('wall-paint', 'TextureArea', { groupId: 'g1' })])
    ).toEqual([])
  })

  it('keeps a follow target that the scene itself provides', () => {
    // The thing a camera follows is a scene element like any other: leaving it out of the list
    // makes it the one object that cannot be chosen as the target.
    expect(followCameraCandidates([element('player', 'Mesh')]).map((c) => c.value)).toEqual([
      'player'
    ])
  })

  it('prefers the label a row is shown under', () => {
    expect(followCameraCandidates([element('mesh-7', 'Group', { label: 'Player' })])).toEqual([
      { value: 'mesh-7', label: 'Player' }
    ])
  })
})
