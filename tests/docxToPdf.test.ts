import { describe, it, expect } from "vitest";
import { parseDocxHtmlToNodes } from "../src/lib/docxToPdf";

describe("parseDocxHtmlToNodes", () => {
  it("parses a heading into a heading node with its level", () => {
    const nodes = parseDocxHtmlToNodes("<h1>Chapter One</h1>");
    expect(nodes).toEqual([{ type: "heading", level: 1, runs: [{ text: "Chapter One", bold: false, italic: false }] }]);
  });

  it("parses a plain paragraph", () => {
    const nodes = parseDocxHtmlToNodes("<p>Hello world.</p>");
    expect(nodes).toEqual([{ type: "paragraph", runs: [{ text: "Hello world.", bold: false, italic: false }] }]);
  });

  it("tracks bold and italic runs within a paragraph", () => {
    const nodes = parseDocxHtmlToNodes("<p>Plain <strong>bold</strong> and <em>italic</em> and <strong><em>both</em></strong>.</p>");
    expect(nodes).toEqual([
      {
        type: "paragraph",
        runs: [
          { text: "Plain ", bold: false, italic: false },
          { text: "bold", bold: true, italic: false },
          { text: " and ", bold: false, italic: false },
          { text: "italic", bold: false, italic: true },
          { text: " and ", bold: false, italic: false },
          { text: "both", bold: true, italic: true },
          { text: ".", bold: false, italic: false },
        ],
      },
    ]);
  });

  it("parses an unordered list into one listItem per <li>, in order", () => {
    const nodes = parseDocxHtmlToNodes("<ul><li>First</li><li>Second</li></ul>");
    expect(nodes).toEqual([
      { type: "listItem", ordered: false, index: 1, runs: [{ text: "First", bold: false, italic: false }] },
      { type: "listItem", ordered: false, index: 2, runs: [{ text: "Second", bold: false, italic: false }] },
    ]);
  });

  it("parses an ordered list with ordered: true", () => {
    const nodes = parseDocxHtmlToNodes("<ol><li>One</li><li>Two</li></ol>");
    expect(nodes.every((n) => n.type === "listItem" && n.ordered === true)).toBe(true);
  });

  it("parses an image into an image node, preserving its src", () => {
    const nodes = parseDocxHtmlToNodes('<img src="data:image/png;base64,abc123">');
    expect(nodes).toEqual([{ type: "image", src: "data:image/png;base64,abc123" }]);
  });

  it("drops an image with no src rather than producing a broken node", () => {
    const nodes = parseDocxHtmlToNodes("<img>");
    expect(nodes).toEqual([]);
  });

  it("parses a table into rows of cells of runs", () => {
    const nodes = parseDocxHtmlToNodes("<table><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table>");
    expect(nodes).toEqual([
      {
        type: "table",
        rows: [
          [[{ text: "A1", bold: false, italic: false }], [{ text: "B1", bold: false, italic: false }]],
          [[{ text: "A2", bold: false, italic: false }], [{ text: "B2", bold: false, italic: false }]],
        ],
      },
    ]);
  });

  it("finds table rows nested inside thead/tbody", () => {
    const nodes = parseDocxHtmlToNodes("<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>");
    expect(nodes).toEqual([
      {
        type: "table",
        rows: [[[{ text: "Name", bold: false, italic: false }]], [[{ text: "Alice", bold: false, italic: false }]]],
      },
    ]);
  });

  it("recurses into an unrecognized wrapper element instead of dropping its content", () => {
    const nodes = parseDocxHtmlToNodes('<div class="wrapper"><p>Still here</p></div>');
    expect(nodes).toEqual([{ type: "paragraph", runs: [{ text: "Still here", bold: false, italic: false }] }]);
  });

  it("turns a <br> into a literal newline within a run rather than dropping it", () => {
    const nodes = parseDocxHtmlToNodes("<p>Line one<br>Line two</p>");
    expect(nodes).toEqual([
      {
        type: "paragraph",
        runs: [
          { text: "Line one", bold: false, italic: false },
          { text: "\n", bold: false, italic: false },
          { text: "Line two", bold: false, italic: false },
        ],
      },
    ]);
  });

  it("preserves document order across mixed block types", () => {
    const nodes = parseDocxHtmlToNodes("<h2>Title</h2><p>Intro.</p><ul><li>Point</li></ul>");
    expect(nodes.map((n) => n.type)).toEqual(["heading", "paragraph", "listItem"]);
  });

  it("drops an empty paragraph rather than emitting an empty node", () => {
    const nodes = parseDocxHtmlToNodes("<p></p><p>Real content.</p>");
    expect(nodes).toEqual([{ type: "paragraph", runs: [{ text: "Real content.", bold: false, italic: false }] }]);
  });
});
