import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "@/lib/markdown";

describe("parseInline", () => {
  it("reads bold, italic, code and links", () => {
    const r = parseInline("a **bold** and *it* and `code` and [site](https://x.dev)");
    expect(r.map((x) => x.t)).toEqual(["text", "bold", "text", "italic", "text", "code", "text", "link"]);
  });
  it("drops unsafe link targets but keeps the words", () => {
    const r = parseInline("[hi](javascript:alert(1))");
    expect(r.some((x) => x.t === "link")).toBe(false);
    expect(r[0]).toEqual({ t: "text", text: "hi" });
    expect(safeHref("/admin/command")).toBe("/admin/command");
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
  });
  it("never produces HTML from angle brackets", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ t: "text", text: "<img src=x onerror=alert(1)>" }]);
  });
});

describe("parseMarkdown", () => {
  it("reads headings, paragraphs and lists", () => {
    const b = parseMarkdown("## Title\n\nHello there\nsecond line\n\n- one\n- two\n\n1. first\n2. second");
    expect(b.map((x) => x.t)).toEqual(["heading", "paragraph", "list", "list"]);
    expect(b[3]).toMatchObject({ t: "list", ordered: true });
    expect((b[1] as { inline: { t: string; text?: string }[] }).inline[0].text).toBe("Hello there second line");
  });
  it("reads tables", () => {
    const b = parseMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ t: "table" });
    expect((b[0] as { rows: unknown[] }).rows).toHaveLength(2);
  });
  it("reads code blocks, including one still being streamed", () => {
    expect(parseMarkdown("```sql\nselect 1;\n```")[0]).toMatchObject({ t: "code", lang: "sql", text: "select 1;" });
    expect(parseMarkdown("```js\nlet x = 1")[0]).toMatchObject({ t: "code", text: "let x = 1" });
  });
  it("reads quotes and rules", () => {
    expect(parseMarkdown("> note\n\n---").map((x) => x.t)).toEqual(["quote", "rule"]);
  });
  it("joins an indented continuation to its list item", () => {
    const b = parseMarkdown("- first line\n  more of it\n- second");
    expect((b[0] as { items: unknown[] }).items).toHaveLength(2);
  });
  it("copes with empty text", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});
