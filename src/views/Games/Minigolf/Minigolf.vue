<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="minigolf">
    <div class="minigolf__card">
      <h1 class="minigolf__title">Minigolf</h1>
      <p class="minigolf__subtitle">Choose your view to play</p>
      <div class="minigolf__options">
        <button class="minigolf__option" @click="router.push('/games/MinigolfTopDown')">
          <span class="minigolf__option-icon">🔭</span>
          <span class="minigolf__option-label">Top-Down</span>
          <span class="minigolf__option-desc">Classic overhead view</span>
        </button>
        <button class="minigolf__option" @click="router.push('/games/MinigolfThirdPerson')">
          <span class="minigolf__option-icon">🎥</span>
          <span class="minigolf__option-label">Third Person</span>
          <span class="minigolf__option-desc">Follow-cam behind the ball</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.minigolf {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding-top: var(--nav-height);
  background: var(--color-background);
}

.minigolf__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 100%;
}

.minigolf__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.minigolf__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  opacity: 0.7;
  margin: 0;
}

.minigolf__options {
  display: flex;
  gap: var(--spacing-3);
  width: 100%;
}

.minigolf__option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-4);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.15s;
}

.minigolf__option:hover {
  border-color: var(--color-primary);
}

.minigolf__option-icon {
  font-size: 2rem;
}

.minigolf__option-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-foreground);
}

.minigolf__option-desc {
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  opacity: 0.6;
  text-align: center;
}
</style>
