/**
 * Course Material PDF Export — converts a DOCX material's bytes into a
 * real PDF, entirely in-house: `mammoth` (already a dependency, used
 * elsewhere only for raw-text extraction in docxParser.ts) turns the
 * document into HTML, with images inlined as base64 data URIs by its
 * own default `convertImage` behavior (see images.dataUri in
 * mammoth/lib/images.js) — no extra image handling needed. That HTML
 * is walked into a small intermediate node tree (`DocxPdfNode[]`, kept
 * separate from any React-PDF JSX so it's unit-testable without
 * rendering), then rendered with `@react-pdf/renderer` — already a
 * dependency, already used for curriculum/certificate/assignment PDFs,
 * and already has its one real Vercel deployment issue (pdfkit's
 * standard-font file-tracing bug) fixed in next.config.js. No new
 * heavy dependency, no headless-browser binary, no third-party API.
 *
 * An HTML tag this walker doesn't specifically recognize is never
 * dropped — it recurses into the tag's own children instead, so plain
 * text nested in an unexpected wrapper still makes it into the PDF
 * (same "never silently lose source content" rule assignmentDocxParser.ts
 * applies to its own fallback handling).
 */
import mammoth from "mammoth";
import { NodeType, parse, type HTMLElement, type Node } from "node-html-parser";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type DocxPdfNode =
  | { type: "heading"; level: number; runs: TextRun[] }
  | { type: "paragraph"; runs: TextRun[] }
  | { type: "listItem"; ordered: boolean; index: number; runs: TextRun[] }
  | { type: "image"; src: string }
  | { type: "table"; rows: TextRun[][][] };

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function elementChildren(el: HTMLElement): HTMLElement[] {
  return el.childNodes.filter(isElement);
}

/** Walks a node's descendants collecting text runs, carrying bold/italic
 * state down through nested <strong>/<em>/<b>/<i>. A <br> becomes a
 * literal newline inside the current run rather than being dropped. */
function extractRuns(el: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  function walk(node: Node, bold: boolean, italic: boolean) {
    if (node.nodeType === NodeType.TEXT_NODE) {
      const text = node.rawText;
      if (text) runs.push({ text, bold, italic });
      return;
    }
    if (!isElement(node)) return;
    const tag = node.tagName?.toLowerCase();
    if (tag === "br") {
      runs.push({ text: "\n", bold, italic });
      return;
    }
    const nextBold = bold || tag === "strong" || tag === "b";
    const nextItalic = italic || tag === "em" || tag === "i";
    for (const child of node.childNodes) walk(child, nextBold, nextItalic);
  }
  for (const child of el.childNodes) walk(child, false, false);
  return runs;
}

/** Finds <tr> rows directly under a table, or one level down inside
 * <thead>/<tbody>/<tfoot> — covers every shape mammoth is known to emit. */
function findRows(el: HTMLElement): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const child of elementChildren(el)) {
    const tag = child.tagName?.toLowerCase();
    if (tag === "tr") rows.push(child);
    else if (tag === "thead" || tag === "tbody" || tag === "tfoot") rows.push(...findRows(child));
  }
  return rows;
}

function elementToNodes(el: HTMLElement): DocxPdfNode[] {
  const tag = el.tagName?.toLowerCase();

  if (tag && /^h[1-6]$/.test(tag)) {
    const runs = extractRuns(el);
    return runs.length > 0 ? [{ type: "heading", level: Number(tag[1]), runs }] : [];
  }
  if (tag === "p") {
    const runs = extractRuns(el);
    return runs.length > 0 ? [{ type: "paragraph", runs }] : [];
  }
  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const items = elementChildren(el).filter((c) => c.tagName?.toLowerCase() === "li");
    return items.map((li, i) => ({ type: "listItem" as const, ordered, index: i + 1, runs: extractRuns(li) }));
  }
  if (tag === "img") {
    const src = el.getAttribute("src");
    return src ? [{ type: "image", src }] : [];
  }
  if (tag === "table") {
    const rows = findRows(el).map((tr) =>
      elementChildren(tr)
        .filter((c) => ["td", "th"].includes(c.tagName?.toLowerCase() ?? ""))
        .map((cell) => extractRuns(cell))
    );
    return rows.length > 0 ? [{ type: "table", rows }] : [];
  }

  // Unrecognized container (div, body, span-as-block, etc.) — recurse
  // into its own element children rather than dropping the content.
  return elementChildren(el).flatMap(elementToNodes);
}

export function parseDocxHtmlToNodes(html: string): DocxPdfNode[] {
  const root = parse(html);
  return elementChildren(root).flatMap(elementToNodes);
}

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10.5, color: "#16302B" },
  docTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  heading1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 8 },
  heading2: { fontSize: 13.5, fontFamily: "Helvetica-Bold", marginTop: 9, marginBottom: 7 },
  headingRest: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 6 },
  paragraph: { fontSize: 10.5, lineHeight: 1.4, marginBottom: 8 },
  listRow: { flexDirection: "row", marginLeft: 14, marginBottom: 4 },
  listBullet: { width: 18, fontSize: 10.5 },
  listText: { fontSize: 10.5, flex: 1, lineHeight: 1.4 },
  image: { marginVertical: 8, maxWidth: "100%" },
  table: { marginBottom: 10, borderWidth: 0.5, borderColor: "#D9D9D9" },
  tableRow: { flexDirection: "row" },
  tableCell: { flex: 1, padding: 4, fontSize: 9.5, borderWidth: 0.5, borderColor: "#D9D9D9" },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  boldItalic: { fontFamily: "Helvetica-BoldOblique" },
});

function runStyle(run: TextRun) {
  if (run.bold && run.italic) return styles.boldItalic;
  if (run.bold) return styles.bold;
  if (run.italic) return styles.italic;
  return undefined;
}

function headingStyle(level: number) {
  if (level === 1) return styles.heading1;
  if (level === 2) return styles.heading2;
  return styles.headingRest;
}

function NodeRenderer({ node }: { node: DocxPdfNode }) {
  switch (node.type) {
    case "heading":
      return (
        <Text style={headingStyle(node.level)}>
          {node.runs.map((r, i) => (
            <Text key={i} style={runStyle(r)}>{r.text}</Text>
          ))}
        </Text>
      );
    case "paragraph":
      return (
        <Text style={styles.paragraph}>
          {node.runs.map((r, i) => (
            <Text key={i} style={runStyle(r)}>{r.text}</Text>
          ))}
        </Text>
      );
    case "listItem":
      return (
        <View style={styles.listRow}>
          <Text style={styles.listBullet}>{node.ordered ? `${node.index}.` : "•"}</Text>
          <Text style={styles.listText}>
            {node.runs.map((r, i) => (
              <Text key={i} style={runStyle(r)}>{r.text}</Text>
            ))}
          </Text>
        </View>
      );
    case "image":
      return <Image src={node.src} style={styles.image} />;
    case "table":
      return (
        <View style={styles.table}>
          {node.rows.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              {row.map((cell, j) => (
                <View key={j} style={styles.tableCell}>
                  <Text>
                    {cell.map((r, k) => (
                      <Text key={k} style={runStyle(r)}>{r.text}</Text>
                    ))}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
  }
}

function DocxPdfDocument({ title, nodes }: { title: string; nodes: DocxPdfNode[] }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.docTitle}>{title}</Text>
        {nodes.map((node, i) => (
          <NodeRenderer key={i} node={node} />
        ))}
      </Page>
    </Document>
  );
}

export async function convertDocxToPdf(buffer: Buffer, title: string): Promise<Buffer> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const nodes = parseDocxHtmlToNodes(html);
  return renderToBuffer(<DocxPdfDocument title={title} nodes={nodes} />);
}
