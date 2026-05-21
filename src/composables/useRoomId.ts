import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Resolve or create a stable room ID from the current route query.
 * If no `room` query param exists, a new UUID is generated and pushed to the URL.
 * @returns Reactive `roomId` ref and the resolved string value.
 */
export const useRoomId = () => {
  const route = useRoute()
  const router = useRouter()

  const existing = route.query.room as string | undefined
  const resolved = existing ?? crypto.randomUUID()

  if (!existing) {
    router.replace({ query: { ...route.query, room: resolved } })
  }

  return { roomId: ref(resolved), resolvedRoomId: resolved, isCreator: !existing }
}
