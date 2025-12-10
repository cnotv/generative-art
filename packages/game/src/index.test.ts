import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGame } from "./index";

describe("createGame", () => {
  const game = { value: undefined as any };

  beforeEach(() => {
    createGame({
      testValue: 0,
      playerName: "TestPlayer",
    }, game);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should set and get custom data", () => {
    game.value.setData("customKey", "customValue");
    expect(game.value.data["customKey"]).toBe("customValue");
  });

  it("should initialize game with custom data", () => {
    const customGame = { value: undefined as any };
    createGame({
      'score': 100,
      'lives': 3,
      'level': 1,
    }, customGame);
    expect(customGame.value.data["score"]).toBe(100);
    expect(customGame.value.data["lives"]).toBe(3);
    expect(customGame.value.data["level"]).toBe(1);
  });

  it("should handle missing initial data gracefully", () => {
    const defaultGame = { value: undefined as any };
    createGame(undefined, defaultGame);
    expect(defaultGame.value.data["anyKey"]).toBeUndefined();
  });
});
