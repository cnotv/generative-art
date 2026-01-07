export type GameStatus = 'idle' | 'playing' | 'paused' | 'game-over';

export interface GameState {
  status: GameStatus;
  data: Record<string, any>;
  setData: (key: string, value: any) => void;
  setStatus: (status: GameStatus) => void;
}

export type RefLike<T> = { value: T }; 
export type LifecycleHook = (callback: () => void) => void;
