<script setup lang="ts"></script>

<template>
  <div class="lobby">
    <p class="lobby__placeholder">Lobby coming soon</p>
  </div>
</template>

<style scoped>
.lobby {
  padding-top: var(--nav-height);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
}

.lobby__placeholder {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-muted-foreground);
}
</style>
