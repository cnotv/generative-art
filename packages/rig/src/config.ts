import type { HumanoidBoneDefinition } from './types'

/**
 * Standard humanoid rig template, named after Mixamo's convention so a generated skeleton
 * matches what a Mixamo-exported clip expects. Positions are fractions of the model's own
 * bounding box rather than absolute units, so the same table fits any humanoid proportions.
 */
export const HUMANOID_BONE_HIERARCHY: HumanoidBoneDefinition[] = [
  { name: 'mixamorigHips', parent: null, heightFraction: 0.52, side: 'center', spreadFraction: 0 },
  {
    name: 'mixamorigSpine',
    parent: 'mixamorigHips',
    heightFraction: 0.58,
    side: 'center',
    spreadFraction: 0
  },
  {
    name: 'mixamorigSpine1',
    parent: 'mixamorigSpine',
    heightFraction: 0.64,
    side: 'center',
    spreadFraction: 0
  },
  {
    name: 'mixamorigSpine2',
    parent: 'mixamorigSpine1',
    heightFraction: 0.7,
    side: 'center',
    spreadFraction: 0
  },
  {
    name: 'mixamorigNeck',
    parent: 'mixamorigSpine2',
    heightFraction: 0.85,
    side: 'center',
    spreadFraction: 0
  },
  {
    name: 'mixamorigHead',
    parent: 'mixamorigNeck',
    heightFraction: 0.9,
    side: 'center',
    spreadFraction: 0
  },
  {
    name: 'mixamorigLeftShoulder',
    parent: 'mixamorigSpine2',
    heightFraction: 0.78,
    side: 'left',
    spreadFraction: 0.2
  },
  {
    name: 'mixamorigLeftArm',
    parent: 'mixamorigLeftShoulder',
    heightFraction: 0.76,
    side: 'left',
    spreadFraction: 0.35
  },
  {
    name: 'mixamorigLeftForeArm',
    parent: 'mixamorigLeftArm',
    heightFraction: 0.6,
    side: 'left',
    spreadFraction: 0.45
  },
  {
    name: 'mixamorigLeftHand',
    parent: 'mixamorigLeftForeArm',
    heightFraction: 0.45,
    side: 'left',
    spreadFraction: 0.5
  },
  {
    name: 'mixamorigRightShoulder',
    parent: 'mixamorigSpine2',
    heightFraction: 0.78,
    side: 'right',
    spreadFraction: 0.2
  },
  {
    name: 'mixamorigRightArm',
    parent: 'mixamorigRightShoulder',
    heightFraction: 0.76,
    side: 'right',
    spreadFraction: 0.35
  },
  {
    name: 'mixamorigRightForeArm',
    parent: 'mixamorigRightArm',
    heightFraction: 0.6,
    side: 'right',
    spreadFraction: 0.45
  },
  {
    name: 'mixamorigRightHand',
    parent: 'mixamorigRightForeArm',
    heightFraction: 0.45,
    side: 'right',
    spreadFraction: 0.5
  },
  {
    name: 'mixamorigLeftUpLeg',
    parent: 'mixamorigHips',
    heightFraction: 0.5,
    side: 'left',
    spreadFraction: 0.15
  },
  {
    name: 'mixamorigLeftLeg',
    parent: 'mixamorigLeftUpLeg',
    heightFraction: 0.28,
    side: 'left',
    spreadFraction: 0.15
  },
  {
    name: 'mixamorigLeftFoot',
    parent: 'mixamorigLeftLeg',
    heightFraction: 0.03,
    side: 'left',
    spreadFraction: 0.15
  },
  {
    name: 'mixamorigRightUpLeg',
    parent: 'mixamorigHips',
    heightFraction: 0.5,
    side: 'right',
    spreadFraction: 0.15
  },
  {
    name: 'mixamorigRightLeg',
    parent: 'mixamorigRightUpLeg',
    heightFraction: 0.28,
    side: 'right',
    spreadFraction: 0.15
  },
  {
    name: 'mixamorigRightFoot',
    parent: 'mixamorigRightLeg',
    heightFraction: 0.03,
    side: 'right',
    spreadFraction: 0.15
  }
]
