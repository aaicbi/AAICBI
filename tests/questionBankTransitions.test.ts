import { describe, it, expect } from "vitest";
import { applyGate1Transition, applyGate2Transition } from "@/lib/questionBank/transitions";

describe("applyGate1Transition", () => {
  it("approves PENDING_REVIEW into PENDING_VALIDATION", () => {
    expect(applyGate1Transition("PENDING_REVIEW", "approve")).toBe("PENDING_VALIDATION");
  });

  it("rejects PENDING_REVIEW into REJECTED", () => {
    expect(applyGate1Transition("PENDING_REVIEW", "reject")).toBe("REJECTED");
  });

  it("refuses to act on a question not awaiting gate 1", () => {
    expect(applyGate1Transition("PENDING_VALIDATION", "approve")).toBeNull();
    expect(applyGate1Transition("APPROVED", "approve")).toBeNull();
    expect(applyGate1Transition(null, "approve")).toBeNull();
  });
});

describe("applyGate2Transition", () => {
  it("approves any of the three non-pass validated statuses into APPROVED", () => {
    expect(applyGate2Transition("VALIDATED_WARNING", "approve")).toBe("APPROVED");
    expect(applyGate2Transition("VALIDATED_FLAGGED", "approve")).toBe("APPROVED");
    expect(applyGate2Transition("VALIDATED_REJECTED", "approve")).toBe("APPROVED");
  });

  it("rejects any of the three non-pass validated statuses into REJECTED", () => {
    expect(applyGate2Transition("VALIDATED_WARNING", "reject")).toBe("REJECTED");
    expect(applyGate2Transition("VALIDATED_FLAGGED", "reject")).toBe("REJECTED");
    expect(applyGate2Transition("VALIDATED_REJECTED", "reject")).toBe("REJECTED");
  });

  it("refuses VALIDATED_PASS — a clean pass never reaches gate 2 at all", () => {
    expect(applyGate2Transition("VALIDATED_PASS", "approve")).toBeNull();
  });

  it("refuses a question not awaiting gate 2", () => {
    expect(applyGate2Transition("PENDING_REVIEW", "approve")).toBeNull();
    expect(applyGate2Transition("APPROVED", "approve")).toBeNull();
  });
});
