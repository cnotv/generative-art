<script setup lang="ts">
import { RIG_BODY_PART_GROUP_LABELS, type RigBodyPartGroup } from './bodyPartGroups'

defineProps<{
  /** Which groups the next capture, photo or preset is currently allowed to touch. */
  activeGroups: Set<RigBodyPartGroup>
}>()

const emit = defineEmits<{
  /** A region was clicked or activated by keyboard; the parent flips that group's flag. */
  toggleGroup: [group: RigBodyPartGroup]
}>()

/** Each region's own accessible label, e.g. "Merge Target: Left Arm". */
const regionLabel = (group: RigBodyPartGroup): string =>
  `Merge Target: ${RIG_BODY_PART_GROUP_LABELS[group]}`
</script>

<template>
  <div class="merge-target-diagram" role="group" aria-label="Merge target body parts">
    <svg viewBox="0 0 100 150" class="merge-target-diagram__figure">
      <!-- Spine / head: the figure faces the viewer, so its own left/right hangs off this
           center line reflected the way a mirror shows them, matching the rig on screen. -->
      <g
        class="merge-target-diagram__region"
        :class="{ 'merge-target-diagram__region--active': activeGroups.has('spineHead') }"
        role="button"
        tabindex="0"
        :aria-pressed="activeGroups.has('spineHead')"
        :aria-label="regionLabel('spineHead')"
        @click="emit('toggleGroup', 'spineHead')"
        @keydown.enter="emit('toggleGroup', 'spineHead')"
        @keydown.space.prevent="emit('toggleGroup', 'spineHead')"
      >
        <circle cx="50" cy="14" r="9" />
        <line x1="50" y1="24" x2="50" y2="70" />
      </g>
      <g
        class="merge-target-diagram__region"
        :class="{ 'merge-target-diagram__region--active': activeGroups.has('rightArm') }"
        role="button"
        tabindex="0"
        :aria-pressed="activeGroups.has('rightArm')"
        :aria-label="regionLabel('rightArm')"
        @click="emit('toggleGroup', 'rightArm')"
        @keydown.enter="emit('toggleGroup', 'rightArm')"
        @keydown.space.prevent="emit('toggleGroup', 'rightArm')"
      >
        <line x1="44" y1="34" x2="18" y2="60" />
      </g>
      <g
        class="merge-target-diagram__region"
        :class="{ 'merge-target-diagram__region--active': activeGroups.has('leftArm') }"
        role="button"
        tabindex="0"
        :aria-pressed="activeGroups.has('leftArm')"
        :aria-label="regionLabel('leftArm')"
        @click="emit('toggleGroup', 'leftArm')"
        @keydown.enter="emit('toggleGroup', 'leftArm')"
        @keydown.space.prevent="emit('toggleGroup', 'leftArm')"
      >
        <line x1="56" y1="34" x2="82" y2="60" />
      </g>
      <g
        class="merge-target-diagram__region"
        :class="{ 'merge-target-diagram__region--active': activeGroups.has('rightLeg') }"
        role="button"
        tabindex="0"
        :aria-pressed="activeGroups.has('rightLeg')"
        :aria-label="regionLabel('rightLeg')"
        @click="emit('toggleGroup', 'rightLeg')"
        @keydown.enter="emit('toggleGroup', 'rightLeg')"
        @keydown.space.prevent="emit('toggleGroup', 'rightLeg')"
      >
        <line x1="46" y1="68" x2="38" y2="140" />
      </g>
      <g
        class="merge-target-diagram__region"
        :class="{ 'merge-target-diagram__region--active': activeGroups.has('leftLeg') }"
        role="button"
        tabindex="0"
        :aria-pressed="activeGroups.has('leftLeg')"
        :aria-label="regionLabel('leftLeg')"
        @click="emit('toggleGroup', 'leftLeg')"
        @keydown.enter="emit('toggleGroup', 'leftLeg')"
        @keydown.space.prevent="emit('toggleGroup', 'leftLeg')"
      >
        <line x1="54" y1="68" x2="62" y2="140" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.merge-target-diagram {
  padding: var(--spacing-2);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.merge-target-diagram__figure {
  width: 3.5rem;
  height: auto;
  display: block;
}

/* Reuses the same strong green/red pair the performance overlay already signals good/bad
   with, rather than the pastel palette everything else here uses: a merge target is a binary
   on/off, and a clear go/no-go colour communicates that faster than a tint would. */
.merge-target-diagram__region {
  cursor: pointer;
  stroke: var(--color-perf-bad);
  stroke-width: 12;
  stroke-linecap: round;
  fill: var(--color-perf-bad);
  transition:
    filter 0.15s ease,
    stroke 0.15s ease,
    fill 0.15s ease;
}

.merge-target-diagram__region:hover {
  filter: brightness(0.85);
}

.merge-target-diagram__region:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

.merge-target-diagram__region--active {
  stroke: var(--color-perf-ok);
  fill: var(--color-perf-ok);
}
</style>
