import { Fragment } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

function renderInline(nodes: Inline[], keyPrefix = "i"): React.ReactNode {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (n.t) {
      case "text":
        return <Fragment key={key}>{n.text}</Fragment>;
      case "bold":
        return <strong key={key} className="font-semibold">{renderInline(n.children, key)}</strong>;
      case "italic":
        return <em key={key}>{renderInline(n.children, key)}</em>;
      case "code":
        return (
          <code key={key} className="rounded bg-brand-gray/50 px-1 py-0.5 font-mono text-[0.85em]">
            {n.text}
          </code>
        );
      case "link":
        return (
          <a key={key} href={n.href} className="font-medium text-brand-teal underline underline-offset-2" {...(n.href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
            {renderInline(n.children, key)}
          </a>
        );
    }
  });
}

const HEADING = {
  1: "mt-5 mb-2 text-xl font-semibold",
  2: "mt-5 mb-2 text-lg font-semibold",
  3: "mt-4 mb-1.5 text-base font-semibold",
  4: "mt-3 mb-1 text-sm font-semibold uppercase tracking-wide text-gray-600",
} as const;

function renderBlock(b: Block, i: number): React.ReactNode {
  switch (b.t) {
    case "heading": {
      const Tag = (`h${Math.min(b.level + 1, 6)}`) as "h2" | "h3" | "h4" | "h5";
      return <Tag key={i} className={`${HEADING[b.level]} text-brand-ink`}>{renderInline(b.inline)}</Tag>;
    }
    case "paragraph":
      return <p key={i} className="my-2 leading-7">{renderInline(b.inline)}</p>;
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag key={i} className={`my-2 space-y-1 pl-6 leading-7 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-gray-500`}>
          {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
        </Tag>
      );
    }
    case "code":
      return (
        <pre key={i} className="my-3 overflow-x-auto rounded-xl border border-brand-gray bg-brand-gray/30 p-3 text-[0.85rem] leading-6">
          <code className="font-mono">{b.text}</code>
        </pre>
      );
    case "table":
      return (
        <div key={i} className="my-3 overflow-x-auto rounded-xl border border-brand-gray">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-brand-gray/30 text-left">
              <tr>{b.header.map((h, j) => <th key={j} className="px-3 py-2 font-semibold">{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j} className="border-t border-brand-gray">
                  {r.map((c, k) => <td key={k} className="px-3 py-2 align-top">{renderInline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return <blockquote key={i} className="my-3 border-l-4 border-brand-teal pl-4 italic text-gray-700">{renderInline(b.inline)}</blockquote>;
    case "rule":
      return <hr key={i} className="my-4 border-brand-gray" />;
  }
}

/** Renders a chat reply's Markdown as real elements; never injects HTML. */
export default function Markdown({ text }: { text: string }) {
  return <div className="break-words text-[0.95rem] text-brand-ink [overflow-wrap:anywhere] [&>:first-child]:mt-0 [&>:last-child]:mb-0">{parseMarkdown(text).map(renderBlock)}</div>;
}
