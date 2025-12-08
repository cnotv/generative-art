import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGameState, GAME_STATUS } from "./index";

describe("Game State", () => {
  let game: ReturnType<typeof createGameState>;

  beforeEach(() => {
    game = createGameState({
      initGameData: (setData) => {
        setData("testValue", 42);
        setData("playerName", "TestPlayer");
      },
    });
    game.initializeGame();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("Data Management", () => {
    it("should initialize with custom data via initGameData", () => {
      expect(game.getData("testValue")).toBe(42);
      expect(game.getData("playerName")).toBe("TestPlayer");
    });

    it("should set and get custom data", () => {
      game.setData("customKey", "customValue");
      expect(game.getData("customKey")).toBe("customValue");
    });

    it("should return default value for non-existent data", () => {
      expect(game.getData("nonExistent", "default")).toBe("default");
    });

    it("should clear all data", () => {
      game.setData("key1", "value1");
      game.setData("key2", "value2");
      game.clearData();
      expect(game.getData("key1")).toBeUndefined();
      expect(game.getData("key2")).toBeUndefined();
    });

    it("should reinitialize game data when called again", () => {
      game.setData("extraKey", "extraValue");
      expect(game.getData("extraKey")).toBe("extraValue");
      
      game.initializeGame();
      expect(game.getData("extraKey")).toBeUndefined();
      expect(game.getData("testValue")).toBe(42);
    });
  });

  describe("Game Status", () => {
    it("should initialize with START status", () => {
      expect(game.getGameStatus()).toBe(GAME_STATUS.START);
      expect(game.isGameStart()).toBe(true);
    });

    it("should change to PLAYING status", () => {
      game.setGameStatus(GAME_STATUS.PLAYING);
      expect(game.isGamePlaying()).toBe(true);
      expect(game.isGameStart()).toBe(false);
    });

    it("should change to GAME_OVER status", () => {
      game.setGameStatus(GAME_STATUS.GAME_OVER);
      expect(game.isGameOver()).toBe(true);
      expect(game.isGamePlaying()).toBe(false);
    });
  });

  describe("Configuration", () => {
    it("should initialize game with custom data", () => {
      const customGame = createGameState({
        initGameData: (setData) => {
          setData("score", 100);
          setData("lives", 3);
          setData("level", 1);
        },
      });
      customGame.initializeGame();
      expect(customGame.getData("score")).toBe(100);
      expect(customGame.getData("lives")).toBe(3);
      expect(customGame.getData("level")).toBe(1);
    });

    it("should handle missing initGameData gracefully", () => {
      const defaultGame = createGameState();
      defaultGame.initializeGame();
      expect(defaultGame.getData("anyKey")).toBeUndefined();
    });
  });
});
