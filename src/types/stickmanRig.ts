import * as THREE from 'three'

/** The rig's named limbs, each independently nudgeable from a panel. */
export type StickmanPartName = 'head' | 'torso' | 'armLeft' | 'armRight' | 'legs'

/** A part's offset from its rest transform: nudged position, plus a size multiplier. */
export type StickmanPartOffset = {
  /** Grouped rather than three loose axes, so the panel can bind one coordinate control. */
  position: { x: number; y: number; z: number }
  scale: number
}

/** One limb node's rest transform, measured once so a panel nudge has a fixed baseline to offset from. */
export type StickmanPartNode = {
  node: THREE.Object3D
  restPosition: THREE.Vector3
  restScale: THREE.Vector3
}

export type StickmanPartRig = Record<StickmanPartName, StickmanPartNode[]>
