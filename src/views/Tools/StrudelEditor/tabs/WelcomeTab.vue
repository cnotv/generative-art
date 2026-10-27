<script setup lang="ts">
import { STRUDEL_FLOW_REFERENCE } from '@webgamekit/strudel-flow'
</script>

<template>
  <div class="strudel-welcome">
    <h3 class="strudel-welcome__heading">welcome</h3>
    <p class="strudel-welcome__text">
      You have found strudel, a live coding platform to write dynamic music pieces in the browser.
      To get started:
    </p>
    <ol class="strudel-welcome__steps">
      <li>hit play</li>
      <li>change something</li>
      <li>hit update</li>
    </ol>
    <p class="strudel-welcome__text">
      Check out the
      <a href="https://strudel.cc/workshop/getting-started/" target="_blank" rel="noopener">
        interactive tutorial
      </a>
      to learn more.
    </p>
    <h3 class="strudel-welcome__heading">about</h3>
    <p class="strudel-welcome__text">
      Strudel is a JavaScript port of TidalCycles, a live coding language for music. Free and
      open-source under AGPL-3.0-or-later.
    </p>
    <p class="strudel-welcome__text">
      The Flow mode follows the nodes, controls and look of
      <a :href="STRUDEL_FLOW_REFERENCE.url" target="_blank" rel="noopener">
        {{ STRUDEL_FLOW_REFERENCE.name }}
      </a>
      by
      <a :href="STRUDEL_FLOW_REFERENCE.authorUrl" target="_blank" rel="noopener">
        {{ STRUDEL_FLOW_REFERENCE.author }}
      </a>
      who also make React Flow. Its source is on
      <a :href="STRUDEL_FLOW_REFERENCE.sourceUrl" target="_blank" rel="noopener">GitHub</a>
      under {{ STRUDEL_FLOW_REFERENCE.license }}.
    </p>
  </div>
</template>

<style scoped>
.strudel-welcome {
  padding: var(--spacing-4);
  font-size: var(--font-size-md);
  line-height: 1.6;
}

.strudel-welcome__heading {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin: 0 0 var(--spacing-2) 0;
}

.strudel-welcome__text {
  margin: 0 0 var(--spacing-3) 0;
}

.strudel-welcome__steps {
  margin: 0 0 var(--spacing-3) 0;
  padding-left: var(--spacing-5);
}
</style>
