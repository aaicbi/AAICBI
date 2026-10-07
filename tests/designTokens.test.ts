import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { DARK_TOKENS, LIGHT_TOKENS, TEXT_PAIRS, type TokenMap } from "@/lib/designTokens";
import { contrastRatio } from "@/lib/contrast";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function parseBlock(selector: string): TokenMap {
  const block = css.match(new RegExp(selector.replace(".", "\\.") + " \\{(.*?)\\n\\}", "s"));
  if (!block) throw new Error(`No ${selector} block in globals.css`);
  const out: TokenMap = {};
  for (const [, name, value] of block[1].matchAll(/--([a-z0-9-]+): ([0-9 ]+);/g)) {
    const [r, g, b] = value.trim().split(/\s+/).map(Number);
    out[name] = [r, g, b];
  }
  return out;
}

describe("design tokens", () => {
  it("light tokens match globals.css", () => {
    expect(LIGHT_TOKENS).toEqual(parseBlock(":root"));
  });
  it("dark tokens match globals.css", () => {
    expect(DARK_TOKENS).toEqual(parseBlock(".dark"));
  });
});

describe("contrast of the text pairs the app relies on (WCAG AA, 4.5:1)", () => {
  for (const [theme, tokens] of [["light", LIGHT_TOKENS], ["dark", DARK_TOKENS]] as const) {
    for (const pair of TEXT_PAIRS) {
      it(`${theme}: ${pair.text} on ${pair.background} (${pair.use})`, () => {
        const ratio = contrastRatio(tokens[pair.text], tokens[pair.background]);
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
