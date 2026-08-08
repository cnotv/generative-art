import { STICKMAN_PART_NAMES, STICKMAN_PART_OFFSET_CONTROLS } from '@/utils/stickmanRig'

/**
 * Only what authoring a character actually needs: how solid the rig is, the
 * drawing guide, its walk cycle, and each limb's placement. The painting
 * toolbar itself is teleported in below these by the editor component.
 */
export const AVATAR_CONFIG_CONTROLS = {
  __defaultOpenGroups: ['parts'] as string[],
  opacity: { min: 0, max: 1, step: 0.05, label: 'Model opacity' },
  showGuide: { checkbox: true, label: 'Show drawing guide' },
  walk: { callback: 'toggleWalk', label: 'Play / stop walking' },
  discard: { callback: 'discardChanges', label: 'Discard all changes' },
  parts: Object.fromEntries(
    STICKMAN_PART_NAMES.map((name) => [name, STICKMAN_PART_OFFSET_CONTROLS])
  )
}
