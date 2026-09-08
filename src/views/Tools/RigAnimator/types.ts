export interface RigAnimatorConfig {
  model: string
  poses: string
  selectedBone: string
  boneRotation: { x: number; y: number; z: number }
  bonePosition: { x: number; y: number; z: number }
  frame: number
  fps: number
  showBoneMarkers: boolean
  cameraUseElbows: boolean
  cameraUseKnees: boolean
  cameraUseNeck: boolean
  cameraUseHips: boolean
  cameraUseDepth: boolean
  cameraReachMultiplier: number
  cameraSmoothingFactor: number
  cameraMaxJump: number
  cameraShowPreview: boolean
  targetLeftArm: boolean
  targetRightArm: boolean
  targetLeftLeg: boolean
  targetRightLeg: boolean
  targetSpineHead: boolean
  physicsEnabled: boolean
  marbleFlowEnabled: boolean
  marbleSpawnInterval: number
  marbleTextures: boolean
  enclosureSize: number
  enclosureOpacity: number
}
