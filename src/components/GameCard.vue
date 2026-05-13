<template>
  <div class="game-card"><slot /></div>
</template>

<style scoped>
.game-card {
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 var(--game-border);
  box-sizing: border-box;
  color: var(--game-ink);
}
</style>
