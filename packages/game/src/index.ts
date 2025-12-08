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

export interface GameConfig {
  initGameData?: (setData: (key: string, value: any) => void) => void;
}

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
} => {
  const game: GameState = {
    status: GAME_STATUS.START as GameStatus,
    data: {},
  };

  // Data accessor functions
  const setData = (key: string, value: any) => {
    game.data[key] = value;
  };

  const getData = <T = any>(key: string, defaultValue?: T): T => {
    return game.data[key] !== undefined ? game.data[key] : defaultValue;
  };

  const clearData = () => {
    game.data = {};
  };

  const initializeGame = () => {
    // Clear existing data
    clearData();
    
    // Call custom initialization function if provided
    if (config?.initGameData) {
      config.initGameData(setData);
    }
  };

  const setGameStatus = (status: GameStatus) => {
    game.status = status;
  };

  const isGamePlaying = () => game.status === GAME_STATUS.PLAYING;
  const isGameStart = () => game.status === GAME_STATUS.START;
  const isGameOver = () => game.status === GAME_STATUS.GAME_OVER;

  const getGameState = () => game;
  const getGameStatus = () => game.status;

  return {
    ...game,
    setGameStatus,
    getGameStatus,
    isGamePlaying,
    isGameStart,
    isGameOver,
    getGameState,
    setData,
    getData,
    clearData,
    initializeGame,
  };
};

export { GAME_STATUS };

// Export a default game state instance for convenience
export const gameState = createGameState();
