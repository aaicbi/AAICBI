/**
 * A small, safe Markdown reader for chat replies: headings, paragraphs,
 * bullet and numbered lists, tables, code blocks, quotes and rules, with bold,
 * italic, inline code and links inside text. It produces plain data that a
 * component turns into React elements, so no HTML is ever injected. Links only
 * keep http(s), mailto and site-relative addresses. Partial text (a reply that
 * is still streaming) is handled: an unclosed code block is shown as code.
 */
export type Inline =
  | { t: "text"; text: string }
  | { t: "bold"; children: Inline[] }
  | { t: "italic"; children: Inline[] }
  | { t: "code"; text: string }
  | { t: "link"; href: string; children: Inline[] };

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4; inline: Inline[] }
  | { t: "paragraph"; inline: Inline[] }
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "code"; lang: string; text: string }
  | { t: "table"; header: Inline[][]; rows: Inline[][][] }
  | { t: "quote"; inline: Inline[] }
  | { t: "rule" };

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", text: buf });
    buf = "";
  };
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`\n]+)`/))) {
      flush();
      out.push({ t: "code", text: m[1] });
      i += m[0].length;
    } else if ((m = rest.match(/^\*\*([^*\n][\s\S]*?)\*\*/)) || (m = rest.match(/^__([^_\n][\s\S]*?)__/))) {
      flush();
      out.push({ t: "bold", children: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*([^*\s][^*\n]*?)\*/)) || (m = rest.match(/^_([^_\s][^_\n]*?)_(?![A-Za-z0-9])/))) {
      flush();
      out.push({ t: "italic", children: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)/))) {
      const href = safeHref(m[2]);
      flush();
      if (href) out.push({ t: "link", href, children: parseInline(m[1]) });
      else out.push({ t: "text", text: m[1] });
      i += m[0].length;
    } else {
      buf += src[i];
      i++;
    }
  }
  flush();
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (absent while streaming)
      blocks.push({ t: "code", lang: fence[1], text: body.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push({ t: "heading", level: h[1].length as 1 | 2 | 3 | 4, inline: parseInline(h[2].trim()) });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: "rule" });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]).map(parseInline));
      blocks.push({ t: "table", header, rows });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", inline: parseInline(body.join(" ")) });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const number = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || number) {
      const ordered = !!number;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = ordered ? lines[i].match(/^\s*\d+[.)]\s+(.*)$/) : lines[i].match(/^\s*[-*•]\s+(.*)$/);
        if (!m) break;
        let text = m[1];
        i++;
        // A continuation line indented under the item belongs to it.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) text += ` ${lines[i++].trim()}`;
        items.push(parseInline(text));
      }
      blocks.push({ t: "list", ordered, items });
      continue;
    }
    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push({ t: "paragraph", inline: parseInline(para.join(" ")) });
  }
  return blocks;
}
