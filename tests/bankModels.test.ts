import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- doubles for everything outside the two bank files ----
const h = vi.hoisted(() => {
  class FakeAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    FakeAPIError,
    create: vi.fn(),
    questionUpdate: vi.fn(async () => ({})),
    questionCreate: vi.fn(async () => ({ id: "newq" })),
    eventCreate: vi.fn(async () => ({})),
    eventCreateMany: vi.fn(async () => ({})),
    pending: [] as unknown[],
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    static APIError = h.FakeAPIError;
    messages = { create: h.create };
  }
  return { default: Anthropic };
});
vi.mock("@/lib/guide/aiGuidance", () => ({ withGuidance: async (s: string) => s }));
vi.mock("@/lib/parsing/moduleMaterialsText", () => ({ getModuleMaterialsText: async () => ({ usable: [{ materialId: "m1", title: "Lesson", text: "Triggers start workflows." }], skipped: [] }) }));
vi.mock("@/lib/embeddings", () => ({
  findDuplicatesForBatch: async (_e: string, qs: unknown[]) => ({ embeddings: qs.map(() => null), matches: qs.map(() => null) }),
  saveQuestionEmbedding: async () => {},
  embeddingsEnabled: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { findUnique: async () => ({ id: "exam1" }) },
    module: { findUniqueOrThrow: async () => ({ title: "Module" }) },
    moduleLearningObjective: { findFirst: async () => ({ id: "obj1", text: "Explain a trigger" }) },
    question: {
      findMany: async () => h.pending,
      count: async () => 0,
      update: h.questionUpdate,
      create: h.questionCreate,
    },
    questionBankEvent: { create: h.eventCreate, createMany: h.eventCreateMany },
  },
}));

import { reviewGeneratedQuestions, validateBankQuestionBatch } from "@/lib/ai/validateBankQuestions";
import { generateBankQuestionBatch } from "@/lib/ai/generateBankQuestions";
import { BankModelError, bankModelInfo } from "@/lib/ai/bankModels";

const q = (id: string, text: string) => ({ id, text, options: [{ text: "Right", isCorrect: true }, { text: "Wrong", isCorrect: false }], bankObjective: { text: "Explain a trigger" } });
const reply = (obj: unknown) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });

/** A reviewer double: finds the answer unless the question says TRAP, and calls a question ambiguous when it says AMBIG. */
function reviewerBehaviour(args: { system: string; messages: { content: string }[] }) {
  const user = args.messages[0].content;
  const texts = [...user.matchAll(/^(\d+)\) (?:Objective: .*\n)?(?:Question: )?(.*)$/gm)].map((m) => ({ i: Number(m[1]), text: m[2] }));
  if (args.system.includes("independently determine")) {
    return reply({ verifications: texts.map((t) => ({ index: t.i, correct_option_index: t.text.includes("TRAP") ? 1 : 0 })) });
  }
  return reply({ results: texts.map((t) => ({ index: t.i, aligned: true, alignmentReason: null, ambiguous: t.text.includes("AMBIG"), ambiguityReason: t.text.includes("AMBIG") ? "Two options fit." : null })) });
}

beforeEach(() => {
  h.create.mockReset();
  h.questionUpdate.mockClear();
  h.questionCreate.mockClear();
  h.eventCreate.mockClear();
  h.eventCreateMany.mockClear();
  h.pending = [];
  delete process.env.BANK_GENERATOR_MODEL;
  delete process.env.BANK_REVIEWER_MODEL;
});
afterEach(() => {
  delete process.env.BANK_GENERATOR_MODEL;
  delete process.env.BANK_REVIEWER_MODEL;
});

describe("which model does what", () => {
  it("defaults to two different models, and either can be changed", () => {
    expect(bankModelInfo().independent).toBe(true);
    expect(bankModelInfo().generator).not.toBe(bankModelInfo().reviewer);
    process.env.BANK_GENERATOR_MODEL = "gen-x";
    process.env.BANK_REVIEWER_MODEL = "gen-x";
    expect(bankModelInfo()).toEqual({ generator: "gen-x", reviewer: "gen-x", independent: false });
  });
});

describe("review of freshly written questions (studio route)", () => {
  it("asks only the reviewer model, and leaves every verdict waiting for a person", async () => {
    process.env.BANK_GENERATOR_MODEL = "gen-x";
    process.env.BANK_REVIEWER_MODEL = "rev-x";
    h.pending = [q("a", "A fine question"), q("b", "A TRAP question"), q("c", "An AMBIG question")];
    h.create.mockImplementation(async (args) => reviewerBehaviour(args));

    const r = await reviewGeneratedQuestions("mod1", 10);

    expect(h.create).toHaveBeenCalled();
    for (const call of h.create.mock.calls) expect(call[0].model).toBe("rev-x");
    expect(r).toMatchObject({ validated: 3, passed: 1, needsReview: 2 });

    const statusOf = (id: string) => (h.questionUpdate.mock.calls as unknown as { where: { id: string }; data: { bankStatus: string } }[][]).map((c) => c[0]).find((c) => c.where.id === id)?.data.bankStatus;
    expect(statusOf("a")).toBe("VALIDATED_PASS"); // waits for approval: NOT approved
    expect(statusOf("b")).toBe("VALIDATED_REJECTED");
    expect(statusOf("c")).toBe("VALIDATED_FLAGGED");
    expect(h.questionUpdate.mock.calls.some((c) => (c as unknown as { data: { bankStatus: string } }[])[0].data.bankStatus === "APPROVED")).toBe(false);
  });

  it("stores which model reviewed, so the studio can say so", async () => {
    process.env.BANK_REVIEWER_MODEL = "rev-x";
    h.pending = [q("a", "A fine question")];
    h.create.mockImplementation(async (args) => reviewerBehaviour(args));
    await reviewGeneratedQuestions("mod1", 10);
    const event = (h.eventCreate.mock.calls[0] as unknown as { data: { kind: string; fromStatus: string; detail: { reviewedBy: string } } }[])[0].data;
    expect(event.kind).toBe("INDEPENDENT_REVIEW_PASS");
    expect(event.fromStatus).toBe("PENDING_REVIEW");
    expect(event.detail.reviewedBy).toBe("rev-x");
  });

  it("stops with a clear message when the reviewer model can't be used, and changes nothing", async () => {
    process.env.BANK_REVIEWER_MODEL = "no-such-model";
    h.pending = [q("a", "A fine question")];
    h.create.mockRejectedValue(new h.FakeAPIError(404, "model not found"));
    await expect(reviewGeneratedQuestions("mod1", 10)).rejects.toThrow(BankModelError);
    await expect(reviewGeneratedQuestions("mod1", 10)).rejects.toThrow(/no-such-model.*isn't available/);
    expect(h.questionUpdate).not.toHaveBeenCalled();
  });

  it("reads the reviewer's verdict even when it is wrapped in a sentence or a code fence", async () => {
    h.pending = [q("a", "A fine question")];
    h.create.mockImplementation(async (args) => {
      const plain = reviewerBehaviour(args) as { content: { text: string }[] };
      return { content: [{ type: "text", text: "Here is my verdict:\n```json\n" + plain.content[0].text + "\n```" }] };
    });
    const r = await reviewGeneratedQuestions("mod1", 10);
    expect(r).toMatchObject({ passed: 1, needsReview: 0 });
  });

  it("still flags a question when the reply simply can't be read (a person looks at it)", async () => {
    h.pending = [q("a", "A fine question")];
    h.create.mockResolvedValue({ content: [{ type: "text", text: "not json" }] });
    const r = await reviewGeneratedQuestions("mod1", 10);
    expect(r.needsReview).toBe(1);
    expect(r.passed).toBe(0);
  });
});

describe("the older route (a person already approved for validation)", () => {
  it("still lets a clean pass go live by itself", async () => {
    h.pending = [q("a", "A fine question")];
    h.create.mockImplementation(async (args) => reviewerBehaviour(args));
    await validateBankQuestionBatch("mod1", 10);
    expect(h.questionUpdate.mock.calls.some((c) => (c as unknown as { data: { bankStatus: string } }[])[0].data.bankStatus === "APPROVED")).toBe(true);
  });
});

describe("writing questions", () => {
  it("has the writer model write them and a different model check them at once", async () => {
    process.env.BANK_GENERATOR_MODEL = "gen-x";
    process.env.BANK_REVIEWER_MODEL = "rev-x";
    h.create.mockImplementation(async (args: { model: string; system: string }) => {
      if (args.system.includes("You write scenario-based")) {
        return reply({ questions: [{ question: "What starts a workflow?", options: ["A trigger", "A filter"], correct_option_index: 0, explanation: "A trigger starts it.", topic: "Triggers" }] });
      }
      return reply({ verifications: [{ index: 0, correct_option_index: 0 }] });
    });

    const r = await generateBankQuestionBatch("mod1", "obj1", "user1", 1);

    expect(r.generated).toBe(1);
    const models = h.create.mock.calls.map((c) => c[0].model);
    expect(models[0]).toBe("gen-x");
    expect(models[1]).toBe("rev-x");
    expect(h.questionCreate).toHaveBeenCalledTimes(1);
    expect((h.questionCreate.mock.calls[0] as unknown as { data: { bankStatus: string; needsReview: boolean } }[])[0].data).toMatchObject({ bankStatus: "PENDING_REVIEW", needsReview: true });
  });

  it("stops with a clear message when the writer model can't be used", async () => {
    process.env.BANK_GENERATOR_MODEL = "no-such-model";
    h.create.mockRejectedValue(new h.FakeAPIError(404, "model not found"));
    await expect(generateBankQuestionBatch("mod1", "obj1", "user1", 1)).rejects.toThrow(/no-such-model.*isn't available/);
    expect(h.questionCreate).not.toHaveBeenCalled();
  });

  describe("a reply that is not perfectly formed (this used to save nothing and say only \"failed\")", () => {
    const writer = (text: string, stop = "end_turn") =>
      h.create.mockImplementation(async (args: { system: string }) =>
        args.system.includes("You write scenario-based")
          ? { content: [{ type: "text", text }], stop_reason: stop }
          : reply({ verifications: [{ index: 0, correct_option_index: 0 }, { index: 1, correct_option_index: 0 }] })
      );
    const q = (n: number, extra: Record<string, unknown> = {}) => ({ question: `What starts workflow ${n}?`, options: ["A trigger", "A filter"], correct_option_index: 0, ...extra });

    it("keeps questions that leave out the optional explanation and topic", async () => {
      writer(JSON.stringify({ questions: [q(1), q(2)] }));
      const r = await generateBankQuestionBatch("mod1", "obj1", "user1", 2);
      expect(r.generated).toBe(2);
      expect(h.questionCreate).toHaveBeenCalledTimes(2);
    });

    it("reads questions when the model adds a sentence or a code fence around them", async () => {
      writer("Here are your questions:\n```json\n" + JSON.stringify({ questions: [q(1), q(2)] }) + "\n```\nHope that helps!");
      expect((await generateBankQuestionBatch("mod1", "obj1", "user1", 2)).generated).toBe(2);
    });

    it("drops one bad question and keeps the rest", async () => {
      writer(JSON.stringify({ questions: [q(1), { question: "No options at all" }, q(3, { correct_option_index: "0" })] }));
      const r = await generateBankQuestionBatch("mod1", "obj1", "user1", 3);
      expect(r.generated).toBe(2);
      expect(r.problem).toBeTruthy();
    });

    it("keeps what arrived when the answer was cut off, and says so", async () => {
      const full = JSON.stringify({ questions: [q(1), q(2), q(3)] });
      writer(full.slice(0, full.indexOf("What starts workflow 3") + 8), "max_tokens");
      const r = await generateBankQuestionBatch("mod1", "obj1", "user1", 3);
      expect(r.generated).toBe(2);
      expect(r.problem).toMatch(/cut short/);
    });

    it("says why when nothing can be used, instead of only counting failures", async () => {
      writer("I'm sorry, I can't write those.");
      const r = await generateBankQuestionBatch("mod1", "obj1", "user1", 3);
      expect(r.generated).toBe(0);
      expect(r.problem).toMatch(/expected format/);
      writer("", "max_tokens");
      expect((await generateBankQuestionBatch("mod1", "obj1", "user1", 3)).problem).toMatch(/cut off/);
    });
  });
});

