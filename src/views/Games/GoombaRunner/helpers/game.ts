// Game status enum-like values
const GAME_STATUS = {
  START: "start",
  PLAYING: "playing",
  GAME_OVER: "gameOver",
} as const;

const HIGH_SCORE_KEY = "goomba-runner-high-score";

export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

const game = {
  score: 0,
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
  game.score = 0;
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

export {
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
  GAME_STATUS,
};
