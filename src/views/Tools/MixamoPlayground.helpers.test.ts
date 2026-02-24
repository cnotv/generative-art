import { describe, it, expect } from "vitest";
import { getActionName } from "./MixamoPlayground.helpers";

describe("getActionName", () => {
  describe("blocking actions (highest priority)", () => {
    it.each([
      ["kick", "kick"],
      ["punch", "punch"],
      ["jump", "jump"],
    ] as const)("returns %s when actions[%s] is active", (action, expected) => {
      expect(getActionName({ [action]: true })).toBe(expected);
    });

    it("kick takes priority over movement", () => {
      expect(getActionName({ kick: true, "move-up": true })).toBe("kick");
    });
  });

  describe("movement actions", () => {
    it.each([
      ["move-up"],
      ["move-down"],
      ["move-left"],
      ["move-right"],
    ] as const)("returns walk2 when only %s is active", (direction) => {
      expect(getActionName({ [direction]: true })).toBe("walk2");
    });

    it("returns running when run is active alongside movement", () => {
      expect(getActionName({ "move-up": true, run: true })).toBe("running");
    });

    it("run alone (no movement) returns idle — run requires movement to take effect", () => {
      expect(getActionName({ run: true })).toBe("idle");
    });

    it("returns roll when roll is active alongside movement", () => {
      expect(getActionName({ "move-up": true, roll: true })).toBe("roll");
    });

    it("roll takes priority over run during movement", () => {
      expect(getActionName({ "move-up": true, roll: true, run: true })).toBe("roll");
    });
  });

  it("returns idle when no actions are active", () => {
    expect(getActionName({})).toBe("idle");
  });
});
