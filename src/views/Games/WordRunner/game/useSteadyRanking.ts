import { onScopeDispose, ref, watch } from 'vue'

type Ranked = { id: string }

/** The players in the order given, any not in it yet after them, keeping their own order. */
export const inRankingOrder = <T extends Ranked>(players: T[], order: string[]): T[] => {
  const place = (player: T): number => {
    const index = order.indexOf(player.id)
    return index === -1 ? order.length : index
  }
  return [...players].sort((first, second) => place(first) - place(second))
}

const orderKey = (players: Ranked[]): string => players.map((player) => player.id).join('\n')

/**
 * The order the players are shown in, which follows their live order only once a new one has
 * held for the given seconds, so two players level with each other do not keep swapping. A
 * player joining or leaving changes the order at once.
 */
export const useSteadyRanking = (players: () => Ranked[], holdSeconds: number) => {
  const order = ref(players().map((player) => player.id))
  let pendingKey = orderKey(players())
  let timer: ReturnType<typeof setTimeout> | undefined

  const show = (ids: string[]): void => {
    clearTimeout(timer)
    timer = undefined
    order.value = ids
  }

  watch(
    () => orderKey(players()),
    (key) => {
      if (key === pendingKey) return
      pendingKey = key
      const ids = key === '' ? [] : key.split('\n')
      const sameMembers =
        ids.length === order.value.length && ids.every((id) => order.value.includes(id))
      if (!sameMembers || key === order.value.join('\n')) {
        show(ids)
        return
      }
      clearTimeout(timer)
      timer = setTimeout(() => show(ids), holdSeconds * 1000)
    }
  )

  onScopeDispose(() => clearTimeout(timer))
  return order
}
