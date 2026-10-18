import { describe, expect, it } from "vitest";
import { cleanOptionText, dependsOnOrder } from "@/lib/arena/arenaPool";
import { ARENA_DEFAULTS, RULE_LIMITS, STEAL_SECONDS } from "@/lib/arena/configCore";

describe("answer options", () => {
  it("keeps options that point at each other in their written order", () => {
    expect(dependsOnOrder(["Use a firewall", "Both A and B", "Neither"])).toBe(true);
    expect(dependsOnOrder(["Encrypt it", "All of the above"])).toBe(true);
    expect(dependsOnOrder(["None of the above", "Guess"])).toBe(true);
    expect(dependsOnOrder(["Option B is right", "x"])).toBe(true);
  });
  it("shuffles ordinary options, including ones that merely mention a letter", () => {
    expect(dependsOnOrder(["Use a password manager", "Reuse one password", "Share it", "Write it down"])).toBe(false);
    expect(dependsOnOrder(["Vitamin A", "Type A blood", "Plan A"])).toBe(false);
  });
  it("removes typed letters that would clash with the letters the game draws", () => {
    expect(cleanOptionText("A) Use a firewall")).toBe("Use a firewall");
    expect(cleanOptionText("b. Encrypt it")).toBe("Encrypt it");
    expect(cleanOptionText("(C) Both")).toBe("Both");
    expect(cleanOptionText("A firewall blocks traffic")).toBe("A firewall blocks traffic");
    expect(cleanOptionText("Apple pie")).toBe("Apple pie");
  });
});

describe("match defaults", () => {
  it("gives a minute per question, 20 questions, no short pick timer", () => {
    expect(ARENA_DEFAULTS.questionSeconds).toBe(60);
    expect(ARENA_DEFAULTS.questionsPerMatch).toBe(20);
    expect(ARENA_DEFAULTS.pickSeconds).toBeGreaterThanOrEqual(RULE_LIMITS.pickSeconds.min);
    expect(ARENA_DEFAULTS.pickSeconds).toBeGreaterThanOrEqual(120);
    expect(STEAL_SECONDS).toBeGreaterThanOrEqual(15);
  });
});
