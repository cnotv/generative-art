import type { ConfigControlsSchema } from '@/stores/viewConfig'
import type { SetupConfig } from '@webgamekit/threejs'

export const shaderTest1Config = {
  shader: {
    frequency: 10
  }
}

export const shaderTest1Schema: ConfigControlsSchema = {
  shader: {
    frequency: { min: 0.1, max: 50, step: 0.1 }
  }
}

export const setupConfig: SetupConfig = {
  ground: false,
  sky: false,
  scene: { backgroundColor: 0x333333 }
}
