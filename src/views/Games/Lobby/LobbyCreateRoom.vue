<script setup lang="ts">
import { ref } from 'vue'
import type { GameType } from '@/types/lobby'
import { GAME_LABELS, GAME_TYPES } from './constants'

const emit = defineEmits<{
  create: [name: string, game: GameType, isHidden: boolean]
  cancel: []
}>()

const name = ref('')
const game = ref<GameType>('Pictionary')
const isHidden = ref(false)

const handleSubmit = (): void => {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('create', trimmed, game.value, isHidden.value)
}
</script>

<template>
  <div class="lb-create">
    <h3 class="lb-create__title">Create a Room</h3>
    <form class="lb-create__form" @submit.prevent="handleSubmit">
      <label class="lb-create__field">
        Room name
        <input
          v-model="name"
          class="lb-create__input"
          type="text"
          maxlength="40"
          placeholder="My room"
          autocomplete="off"
        />
      </label>
      <label class="lb-create__field">
        Game
        <select v-model="game" class="lb-create__select">
          <option v-for="g in GAME_TYPES" :key="g" :value="g">{{ GAME_LABELS[g] }}</option>
        </select>
      </label>
      <label class="lb-create__checkbox">
        <input v-model="isHidden" type="checkbox" />
        Hidden room (invite via link only)
      </label>
      <div class="lb-create__actions">
        <button class="lb-create__btn" type="submit" :disabled="!name.trim()">Create</button>
        <button class="lb-create__btn lb-create__btn--ghost" type="button" @click="emit('cancel')">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.lb-create {
  padding: var(--spacing-3);
  border-top: 2px solid var(--color-border);
}

.lb-create__title {
  margin: 0 0 var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: #111;
}

.lb-create__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.lb-create__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #111;
}

.lb-create__input,
.lb-create__select {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
  outline: none;
}

.lb-create__checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #111;
  cursor: pointer;
}

.lb-create__actions {
  display: flex;
  gap: var(--spacing-2);
}

.lb-create__btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #444;
  transition: transform 0.1s ease;
}

.lb-create__btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #444;
}

.lb-create__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lb-create__btn--ghost {
  background: #fff;
  color: #111;
}
</style>
