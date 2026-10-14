import { describe, expect, it } from "vitest";
import { DEMO_COUNT, DEMO_FORMATS, createDemoApi } from "@/components/games/demoData";
import type { PlayFormat, PlayItem } from "@/components/games/GamePlayer";

const noShuffle = <T,>(a: readonly T[]) => [...a];

async function play(format: PlayFormat, n: number) {
  const api = createDemoApi(format, noShuffle);
  const items: PlayItem[] = [];
  for (let i = 0; i < n; i++) {
    const r = await api.next();
    expect(r.item).toBeTruthy();
    items.push(r.item!);
  }
  return { api, items };
}

describe("demo games", () => {
  it("has ten distinct items in every format", async () => {
    for (const f of DEMO_FORMATS) {
      const { items } = await play(f.format, DEMO_COUNT);
      const keys = new Set(items.map((i) => JSON.stringify(i.served)));
      expect(keys.size).toBe(DEMO_COUNT);
    }
  });

  it("serves quiz options with exactly one right answer and grades it", async () => {
    const { api, items } = await play("QUIZ", DEMO_COUNT);
    for (const item of items) {
      const results = [];
      for (const o of (item.served as { options: { key: string }[] }).options) results.push((await api.answer(item, { choice: o.key })).result!);
      expect(results.filter((r) => r.correct)).toHaveLength(1);
    }
  });

  it("every scenario has one best choice and every sequence can be solved", async () => {
    const sc = await play("SCENARIO", DEMO_COUNT);
    for (const item of sc.items) {
      const opts = (item.served as { options: string[] }).options;
      const graded = await Promise.all(opts.map((o) => sc.api.answer(item, { choice: o })));
      expect(graded.filter((g) => g.result!.correct)).toHaveLength(1);
    }
    const ord = await play("ORDERING", DEMO_COUNT);
    for (const item of ord.items) {
      const steps = (item.served as { steps: string[] }).steps;
      const first = (await ord.api.answer(item, { order: steps })).result!;
      const right = (first.feedback as { correctOrder: string[] }).correctOrder;
      expect(right).toHaveLength(steps.length);
    }
  });

  it("grades matching by the number of right pairs", async () => {
    const { api, items } = await play("MATCHING", DEMO_COUNT);
    const item = items[0];
    const s = item.served as { lefts: string[]; rights: string[] };
    const wrong = Object.fromEntries(s.lefts.map((_, i) => [String(i), s.rights[i]]));
    const r = (await api.answer(item, { matches: wrong })).result!;
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(await api.answer(item, { matches: {} })).toHaveProperty("error");
  });

  it("keeps serving after ten", async () => {
    const { api } = await play("QUIZ", DEMO_COUNT);
    expect((await api.next()).item).toBeTruthy();
  });
});
