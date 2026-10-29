import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { renderStrudelSound } from '@/utils/soundRender'
import { playPreview } from '@/utils/soundPreview'
import { readStorage, writeStorage } from '@/utils/storage'
import { STRUDEL_SAVED_CODE_STORAGE_KEY } from '@/views/Tools/StrudelEditor/config'
import type { SoundApplyHandler, SoundSlot, SoundSlotStatus } from '@/types/soundPanel'

/**
 * What the Sound panel edits: the sounds the current game registered, the code being edited for
 * each, and how the last render of each went. A game registers on mount and unregisters on
 * unmount, like the Config panel.
 */
export const useSoundPanelStore = defineStore('soundPanel', () => {
  const routeName = ref<string | null>(null)
  const slots = ref<SoundSlot[]>([])
  const codes = ref<Record<string, string>>({})
  const statuses = ref<Record<string, SoundSlotStatus>>({})
  const errors = ref<Record<string, string>>({})
  const selectedId = ref<string | null>(null)
  const playingId = ref<string | null>(null)
  const editorSlotId = ref<string | null>(null)
  // A function is not state worth tracking in devtools, so it stays out of the reactive tree.
  let applyHandler: SoundApplyHandler | null = null
  let stopPreview: (() => void) | null = null
  // The last render of each sound and the code it came from, so Play then Apply renders once.
  const renderCache = shallowRef<Record<string, { code: string; wav: ArrayBuffer }>>({})

  const isAvailable = computed(() => slots.value.length > 0)
  const selectedSlot = computed(() => slots.value.find((slot) => slot.id === selectedId.value))

  const findSlot = (id: string): SoundSlot | undefined => slots.value.find((slot) => slot.id === id)
  const codeOf = (id: string): string => codes.value[id] ?? ''
  const statusOf = (id: string): SoundSlotStatus => statuses.value[id] ?? 'idle'
  const errorOf = (id: string): string => errors.value[id] ?? ''
  const isModified = (id: string): boolean => codeOf(id) !== findSlot(id)?.code

  const setStatus = (id: string, status: SoundSlotStatus, error = ''): void => {
    statuses.value = { ...statuses.value, [id]: status }
    errors.value = { ...errors.value, [id]: error }
  }

  const renderSlot = async (slot: SoundSlot, code: string): Promise<ArrayBuffer> => {
    const cached = renderCache.value[slot.id]
    if (cached?.code === code) return cached.wav
    const wav = await renderStrudelSound(code, slot)
    renderCache.value = { ...renderCache.value, [slot.id]: { code, wav } }
    return wav
  }

  const stopPlayback = (): void => {
    stopPreview?.()
    stopPreview = null
    playingId.value = null
  }

  const register = (
    newRouteName: string,
    newSlots: SoundSlot[],
    onApply: SoundApplyHandler
  ): void => {
    routeName.value = newRouteName
    slots.value = newSlots
    codes.value = Object.fromEntries(newSlots.map((slot) => [slot.id, slot.code]))
    statuses.value = {}
    errors.value = {}
    selectedId.value = newSlots[0]?.id ?? null
    applyHandler = onApply
    renderCache.value = {}
  }

  const unregister = (name: string): void => {
    if (routeName.value !== name) return
    stopPlayback()
    editorSlotId.value = null
    renderCache.value = {}
    routeName.value = null
    slots.value = []
    codes.value = {}
    statuses.value = {}
    errors.value = {}
    selectedId.value = null
    applyHandler = null
  }

  const select = (id: string): void => {
    selectedId.value = id
  }

  const setCode = (id: string, code: string): void => {
    codes.value = { ...codes.value, [id]: code }
  }

  const apply = async (id: string): Promise<void> => {
    const slot = findSlot(id)
    if (!slot || !applyHandler || statusOf(id) === 'rendering') return
    setStatus(id, 'rendering')
    try {
      const wav = await renderSlot(slot, codeOf(id))
      await applyHandler(id, wav)
      setStatus(id, 'applied')
    } catch (error) {
      setStatus(id, 'error', error instanceof Error ? error.message : 'The code did not render')
    }
  }

  const togglePreview = async (id: string): Promise<void> => {
    if (playingId.value === id) {
      stopPlayback()
      return
    }
    const slot = findSlot(id)
    if (!slot || statusOf(id) === 'rendering') return
    stopPlayback()
    const statusBefore = statusOf(id)
    setStatus(id, 'rendering')
    try {
      const wav = await renderSlot(slot, codeOf(id))
      setStatus(id, statusBefore)
      stopPreview = playPreview(wav, slot.kind === 'loop', () => {
        if (playingId.value !== id) return
        stopPreview = null
        playingId.value = null
      })
      playingId.value = id
    } catch (error) {
      setStatus(id, 'error', error instanceof Error ? error.message : 'The code did not render')
    }
  }

  // The full editor opens on whatever code it saved last, so the sound's code is saved first.
  const openEditor = (id: string): void => {
    stopPlayback()
    writeStorage(STRUDEL_SAVED_CODE_STORAGE_KEY, codeOf(id))
    editorSlotId.value = id
  }

  const closeEditor = (takeCode: boolean): void => {
    const id = editorSlotId.value
    const editedCode = takeCode ? readStorage(STRUDEL_SAVED_CODE_STORAGE_KEY) : null
    if (id !== null && editedCode !== null) setCode(id, editedCode)
    editorSlotId.value = null
  }

  const reset = async (id: string): Promise<void> => {
    const slot = findSlot(id)
    if (!slot) return
    setCode(id, slot.code)
    await applyHandler?.(id, null)
    setStatus(id, 'idle')
  }

  return {
    routeName,
    slots,
    selectedId,
    playingId,
    editorSlotId,
    selectedSlot,
    isAvailable,
    codeOf,
    statusOf,
    errorOf,
    isModified,
    register,
    unregister,
    select,
    setCode,
    apply,
    togglePreview,
    openEditor,
    closeEditor,
    reset
  }
})
