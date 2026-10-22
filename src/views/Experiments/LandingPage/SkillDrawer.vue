<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import type { SkillArea } from './types'

const props = defineProps<{
  /** The area to present, or null when the drawer is closed. */
  area: SkillArea | null
}>()

const emit = defineEmits<{ close: [] }>()

const onOpenChange = (isOpen: boolean): void => {
  if (!isOpen) emit('close')
}
</script>

<template>
  <!-- The UI kit's Sheet is the panel system's host, portalled into the side panels and never
       dismissed from outside; this is a page drawer, so it uses the same dialog primitives
       directly: modal, focus kept inside, Escape and the overlay close it. -->
  <DialogRoot :open="props.area !== null" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="skill-drawer__overlay" />
      <DialogContent class="skill-drawer">
        <template v-if="props.area">
          <header class="skill-drawer__header">
            <DialogTitle class="skill-drawer__title">{{ props.area.title }}</DialogTitle>
            <DialogClose as-child>
              <IconButton title="Close" aria-label="Close" class="skill-drawer__close">
                <X aria-hidden="true" />
              </IconButton>
            </DialogClose>
          </header>
          <DialogDescription class="skill-drawer__lead">{{ props.area.line }}</DialogDescription>

          <section class="skill-drawer__section" aria-labelledby="skill-drawer-tools">
            <h3 id="skill-drawer-tools" class="skill-drawer__label">Tools and practices</h3>
            <ul class="skill-drawer__tools">
              <li v-for="tool in props.area.tools" :key="tool" class="skill-drawer__tool">
                {{ tool }}
              </li>
            </ul>
          </section>

          <section class="skill-drawer__section" aria-labelledby="skill-drawer-highlights">
            <h3 id="skill-drawer-highlights" class="skill-drawer__label">Highlights</h3>
            <ol class="skill-drawer__highlights">
              <li
                v-for="highlight in props.area.highlights"
                :key="highlight.text"
                class="skill-drawer__highlight"
              >
                <p class="skill-drawer__where">{{ highlight.company }}, {{ highlight.period }}</p>
                <p class="skill-drawer__text">{{ highlight.text }}</p>
              </li>
            </ol>
          </section>

          <figure v-if="props.area.quote" class="skill-drawer__quote">
            <blockquote class="skill-drawer__quote-text">{{ props.area.quote.text }}</blockquote>
            <figcaption class="skill-drawer__quote-author">
              {{ props.area.quote.author }}
            </figcaption>
          </figure>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Drawn over the dark landing page, so every colour comes from the canvas overlay tokens. */
.skill-drawer__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background-color: var(--color-canvas-overlay-scrim);
}

.skill-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-modal);
  box-sizing: border-box;
  width: min(30rem, 100%);
  overflow-y: auto;
  padding: var(--spacing-8) var(--spacing-6);
  border-left: var(--spacing-px) solid var(--color-canvas-overlay-border);
  background-color: var(--color-canvas-overlay-surface);
  color: var(--color-canvas-overlay-foreground);
  font-family: var(--font-mono);
}

.skill-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-4);
}

.skill-drawer__title {
  margin: 0;
  color: var(--color-canvas-overlay-accent);
  font-family: var(--font-sign);
  font-size: var(--font-size-xl);
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.skill-drawer__close {
  color: var(--color-canvas-overlay-muted);
}

.skill-drawer__lead {
  margin: var(--spacing-3) 0 0;
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-base);
  line-height: 1.6;
}

.skill-drawer__section {
  margin-top: var(--spacing-8);
}

.skill-drawer__label {
  margin: 0 0 var(--spacing-3);
  color: var(--color-lcd-text);
  font-size: var(--font-size-2xs);
  font-weight: normal;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.skill-drawer__tools {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: var(--spacing-2);
}

.skill-drawer__tool {
  padding: var(--spacing-1) var(--spacing-3);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  border-radius: var(--radius-full);
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-xs);
}

.skill-drawer__highlights {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: var(--spacing-4);
}

.skill-drawer__highlight {
  padding-left: var(--spacing-3);
  border-left: var(--spacing-0-5) solid var(--color-canvas-overlay-border);
}

.skill-drawer__where,
.skill-drawer__text {
  margin: 0;
}

.skill-drawer__where {
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.skill-drawer__text {
  margin-top: var(--spacing-1);
  font-size: var(--font-size-base);
  line-height: 1.6;
}

.skill-drawer__quote {
  margin: var(--spacing-8) 0 0;
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  background-color: var(--color-lcd-surface);
}

.skill-drawer__quote-text {
  margin: 0;
  font-size: var(--font-size-base);
  font-style: italic;
  line-height: 1.6;
}

.skill-drawer__quote-author {
  margin-top: var(--spacing-2);
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-xs);
}

@media (prefers-reduced-motion: no-preference) {
  .skill-drawer[data-state='open'] {
    animation: skill-drawer-in 0.25s ease-out;
  }

  .skill-drawer[data-state='closed'] {
    animation: skill-drawer-in 0.2s ease-in reverse;
  }
}

@keyframes skill-drawer-in {
  from {
    transform: translateX(100%);
  }
}
</style>
