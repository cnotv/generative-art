import { STICKMAN_PART_NAMES, STICKMAN_PART_OFFSET_CONTROLS } from '@/utils/stickmanRig'

/**
 * Only what authoring a character actually needs: whether the rig is shown,
 * its walk cycle, and each limb's placement. The painting toolbar itself is
 * teleported in below these by the editor component.
 */
export const AVATAR_CONFIG_CONTROLS = {
  __defaultOpenGroups: ['parts'] as string[],
  visible: { checkbox: true, label: 'Show model' },
  walk: { callback: 'toggleWalk', label: 'Play / stop walking' },
  parts: Object.fromEntries(
    STICKMAN_PART_NAMES.map((name) => [name, STICKMAN_PART_OFFSET_CONTROLS])
  )
}
