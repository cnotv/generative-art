// Game status enum-like values
const GAME_STATUS = {
  START: "start",
  PLAYING: "playing",
  GAME_OVER: "gameOver",
} as const;

export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

export interface GameState {
  score: number;
  highestScore: number;
  isNewHighScore: boolean;
  status: GameStatus;
}

export interface GameConfig {
  highScoreKey?: string;
  initialScore?: number;
}

export const createGameState = (config?: GameConfig): GameState & {
  loadHighScore: () => number;
  checkHighScore: () => boolean;
  setGameStatus: (status: GameStatus) => void;
  getGameStatus: () => GameStatus;
  resetGameScore: () => void;
  incrementGameScore: (points: number) => void;
  isGamePlaying: () => boolean;
  isGameStart: () => boolean;
  isGameOver: () => boolean;
  getGameScore: () => number;
  getHighestScore: () => number;
  getIsNewHighScore: () => boolean;
  getGameState: () => GameState;
} => {
  const HIGH_SCORE_KEY = config?.highScoreKey || "game-high-score";

  const game: GameState = {
    score: config?.initialScore || 0,
    highestScore: 0,
    isNewHighScore: false,
    status: GAME_STATUS.START as GameStatus,
  };

  const loadHighScore = () => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    const parsed = saved ? parseInt(saved, 10) : 0;
    game.highestScore = isNaN(parsed) ? 0 : parsed;
    return game.highestScore;
  };

  const checkHighScore = () => {
    game.isNewHighScore = game.score > game.highestScore;
    if (game.isNewHighScore) {
      localStorage.setItem(HIGH_SCORE_KEY, game.score.toString());
      game.highestScore = game.score;
    }
    return game.isNewHighScore;
  };

  const setGameStatus = (status: GameStatus) => {
    game.status = status;
  };

  const resetGameScore = () => {
    game.score = config?.initialScore || 0;
    game.isNewHighScore = false;
  };

  const incrementGameScore = (points: number) => {
    if (!isNaN(points)) {
      game.score += points;
    }
  };

  const isGamePlaying = () => game.status === GAME_STATUS.PLAYING;
  const isGameStart = () => game.status === GAME_STATUS.START;
  const isGameOver = () => game.status === GAME_STATUS.GAME_OVER;

  const getGameState = () => game;
  const getGameStatus = () => game.status;
  const getGameScore = () => game.score;
  const getHighestScore = () => game.highestScore;
  const getIsNewHighScore = () => game.isNewHighScore;

  return {
    ...game,
    loadHighScore,
    checkHighScore,
    setGameStatus,
    getGameStatus,
    resetGameScore,
    incrementGameScore,
    isGamePlaying,
    isGameStart,
    isGameOver,
    getGameScore,
    getHighestScore,
    getIsNewHighScore,
    getGameState,
  };
};

export { GAME_STATUS };

// Export a default game state instance for convenience
export const gameState = createGameState();
