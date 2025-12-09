// Game status enum-like values
const GAME_STATUS = {
  START: "start",
  PLAYING: "playing",
  GAME_OVER: "gameOver",
} as const;

export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

export interface GameState {
  status: GameStatus;
  data: {
    [key: string]: any;
  };
}

export type GameConfig = Record<string, any> 

export const createGameState = (config?: GameConfig): GameState & {
  setGameStatus: (status: GameStatus) => void;
  getGameStatus: () => GameStatus;
  isGamePlaying: () => boolean;
  isGameStart: () => boolean;
  isGameOver: () => boolean;
  getGameState: () => GameState;
  setData: (key: string, value: any) => void;
  getData: <T = any>(key: string, defaultValue?: T) => T;
  clearData: () => void;
  initializeGame: () => void;
  gameState: GameState;
} => {
  const gameState: GameState = {
    status: GAME_STATUS.START as GameStatus,
    data: { ...(config|| {})},
  };

  // Data accessor functions
  const setData = (key: string, value: any) => gameState.data[key] = value;
  const getData = <T = any>(key: string, defaultValue?: T): T => gameState.data[key] !== undefined ? gameState.data[key] : defaultValue;
  const clearData = () => gameState.data = {};
  const setGameStatus = (status: GameStatus) => gameState.status = status;

  const isGamePlaying = () => gameState.status === GAME_STATUS.PLAYING;
  const isGameStart = () => gameState.status === GAME_STATUS.START;
  const isGameOver = () => gameState.status === GAME_STATUS.GAME_OVER;

  const getGameState = () => gameState;
  const getGameStatus = () => gameState.status;

  return {
    gameState,
    setGameStatus,
    getGameStatus,
    isGamePlaying,
    isGameStart,
    isGameOver,
    getGameState,
    setData,
    getData,
    clearData,
  };
};

export { GAME_STATUS };
