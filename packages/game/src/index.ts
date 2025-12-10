export type GameStatus = 'idle' | 'playing' | 'paused' | 'game-over';
export interface GameState {
  status: GameStatus;
  data: Record<string, any>;
  setData: (key: string, value: any) => void;
  setStatus: (status: GameStatus) => void;
}

type RefLike<T> = { value: T }; 
type LifecycleHook = (callback: () => void) => void;

/**
 * Initialize a game state management system
 * @param initialConfig Initial game data configuration in a dictionary format
 * @param bindTo Optional reference to bind the game state to (e.g., Vue Ref, React State)
 * @param cleanupHook Optional lifecycle hook for cleanup for garbage collection
 * @returns 
 */
export function createGame(
  initialConfig: Record<string, any>,
  bindTo?: RefLike<GameState | undefined>,
  cleanupHook?: LifecycleHook
): GameState {
  let _status: GameStatus = 'idle';
  let _data = { ...initialConfig };
  const _listeners = new Set<(s: GameState) => void>();

  const createSnapshot = (): GameState => {
    return {
      status: _status,
      data: _data,
      setData,
      setStatus
    };
  };

  const notify = () => {
    const snapshot = createSnapshot();

    if (bindTo) {
      bindTo.value = snapshot;
    }

    _listeners.forEach((cb) => cb(snapshot));
  };

  const setData = (key: string, value: any) => {
    try {
      _data = { ..._data, [key]: value };
    } catch (error) {
      console.error(`Error setting data for key ${key} with value ${value}`, error);
    }
    notify();
  };

  const setStatus = (newStatus: GameStatus) => {
    _status = newStatus;
    notify();
  };
  
  const initialState = createSnapshot();

  if (bindTo) {
    bindTo.value = initialState;
  }

  if (cleanupHook) {
    cleanupHook(() => {
      _listeners.clear();
      if(bindTo) bindTo.value = undefined; 
    });
  }

  return initialState;
}
