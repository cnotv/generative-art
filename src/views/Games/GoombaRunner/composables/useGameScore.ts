import { createGameState } from "@webgametoolkit/game";
import {
  initGameData,
  loadHighScore as loadHighScoreHelper,
  checkHighScore as checkHighScoreHelper,
  incrementGameScore as incrementGameScoreHelper,
  getGameScore as getGameScoreHelper,
  getHighestScore as getHighestScoreHelper,
  getIsNewHighScore as getIsNewHighScoreHelper,
} from "../helpers/setup";

// Create a singleton game state instance for GoombaRunner
const gameState = createGameState({
  initGameData,
});

const { getData, setData, setGameStatus, getGameStatus, initializeGame, isGamePlaying, isGameStart, isGameOver } = gameState;

// Export wrapper functions that use the game state's getData/setData
export const loadHighScore = () => loadHighScoreHelper(getData, setData);
export const checkHighScore = () => checkHighScoreHelper(getData, setData);
export const incrementGameScore = (points: number) => incrementGameScoreHelper(getData, setData, points);
export const getGameScore = () => getGameScoreHelper(getData);
export const getHighestScore = () => getHighestScoreHelper(getData);
export const getIsNewHighScore = () => getIsNewHighScoreHelper(getData);
export const resetGameScore = () => setData("score", 0);

// Re-export game state methods
export {
  gameState,
  setGameStatus,
  getGameStatus,
  initializeGame,
  isGamePlaying,
  isGameStart,
  isGameOver,
  getData,
  setData,
};
