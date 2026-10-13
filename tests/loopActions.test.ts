import { describe, expect, it } from "vitest";
import { ActionInputError, LOOP_ACTIONS, LOOP_ACTION_BY_NAME, type EngineState } from "@/lib/loop/actions";
import { BROADCAST_CONFIRM_THRESHOLD, decideExecution } from "@/lib/loop/policy";

const scope = { userId: "u1", role: "SUPER_ADMIN", isSuper: true };
const empty: EngineState = { scope, resolvedRecipients: null, reviewedTrainee: null };
const resolved = (count: number): EngineState => ({
  scope,
  resolvedRecipients: { filter: { scope: "ALL_TRAINEES" }, description: "All trainees", count, truncated: false },
  reviewedTrainee: null,
});

describe("Loop actions", () => {
  it("every action has a name, a description and a schema Claude can read", () => {
    expect(new Set(LOOP_ACTIONS.map((a) => a.name)).size).toBe(LOOP_ACTIONS.length);
    for (const a of LOOP_ACTIONS) {
      expect(a.description.length).toBeGreaterThan(20);
      expect(a.inputSchema.type).toBe("object");
      for (const r of a.inputSchema.required) expect(a.inputSchema.properties).toHaveProperty(r);
    }
  });

  it("a message cannot be prepared without a resolve_recipients result, and its recipients come only from that result", async () => {
    const send = LOOP_ACTION_BY_NAME.get("send_message")!;
    await expect(send.prepare({ subject: "Hi", body: "There" }, empty)).rejects.toBeInstanceOf(ActionInputError);
    const p = await send.prepare({ subject: "Hi", body: "There", recipientFilter: { scope: "EVERYONE" }, recipientDescription: "everyone" }, resolved(3));
    expect(p.input.recipientFilter).toEqual({ scope: "ALL_TRAINEES" });
    expect(p.input.recipientDescription).toBe("All trainees");
    expect(p.risk).toBe("high");
  });

  it("a message to a large audience is always confirmed, even at level 3", async () => {
    const send = LOOP_ACTION_BY_NAME.get("send_message")!;
    const small = await send.prepare({ subject: "Hi", body: "There" }, resolved(BROADCAST_CONFIRM_THRESHOLD));
    const large = await send.prepare({ subject: "Hi", body: "There" }, resolved(BROADCAST_CONFIRM_THRESHOLD + 1));
    expect(decideExecution({ level: 3, risk: small.risk, alwaysConfirm: small.alwaysConfirm })).toBe("run");
    expect(decideExecution({ level: 3, risk: large.risk, alwaysConfirm: large.alwaysConfirm })).toBe("ask");
  });

  it("suspending messaging needs a trainee Loop actually read, and cannot name another", async () => {
    const suspend = LOOP_ACTION_BY_NAME.get("suspend_messaging")!;
    await expect(suspend.prepare({ reason: "abuse" }, empty)).rejects.toBeInstanceOf(ActionInputError);
    const p = await suspend.prepare({ reason: "abuse", traineeId: "someone-else" }, { scope, resolvedRecipients: null, reviewedTrainee: { traineeId: "t1", traineeName: "Ada" } });
    expect(p.input.traineeId).toBe("t1");
    expect(p.risk).toBe("high");
  });

  it("nothing in the registry deletes anything", () => {
    for (const a of LOOP_ACTIONS) expect(a.name).not.toMatch(/delete|remove|drop|purge/);
  });
});
