export type GameStatus = 'idle' | 'playing' | 'paused' | 'game-over'

export interface GameState {
  status: GameStatus
  data: Record<string, unknown>
  setData: (key: string, value: unknown) => void
  setStatus: (status: GameStatus) => void
}

export type RefLike<T> = { value: T }
export type LifecycleHook = (callback: () => void) => void
