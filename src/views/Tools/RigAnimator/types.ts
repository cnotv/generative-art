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
  cameraUseHips: boolean
  cameraUseDepth: boolean
  cameraUseViewpoint: boolean
}
