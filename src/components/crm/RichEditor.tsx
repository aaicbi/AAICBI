"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface RichEditorHandle { insertText: (t: string) => void }

const btn = "min-h-[40px] min-w-[40px] rounded-lg border border-brand-gray bg-brand-surface px-2 text-sm font-bold text-brand-ink hover:bg-brand-mint";

/**
 * A small rich-text box for emails: bold, italic, links and lists. It keeps plain HTML; the server cleans it again before anything is stored or
 * sent. `resetKey` loads new content (a chosen template, a saved draft) without fighting the cursor while someone types.
 */
const RichEditor = forwardRef<RichEditorHandle, { initialHtml: string; resetKey: string; onChange: (html: string) => void; label: string }>(function RichEditor({ initialHtml, resetKey, onChange, label }, ref) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (box.current) { box.current.innerHTML = initialHtml; onChange(initialHtml); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [resetKey]);
  const run = (cmd: string, value?: string) => { box.current?.focus(); document.execCommand(cmd, false, value); onChange(box.current?.innerHTML ?? ""); };
  useImperativeHandle(ref, () => ({ insertText: (t: string) => run("insertText", t) }));
  return (
    <div>
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-brand-gray bg-brand-mint/40 p-1.5">
        <button type="button" className={btn} aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => run("bold")}><b>B</b></button>
        <button type="button" className={btn} aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run("italic")}><i>I</i></button>
        <button type="button" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => { const url = window.prompt("Link address (starts with https://)"); if (url) run("createLink", url.trim()); }}>Link</button>
        <button type="button" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => run("insertUnorderedList")}>• List</button>
        <button type="button" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => run("insertOrderedList")}>1. List</button>
        <button type="button" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => run("removeFormat")}>Clear</button>
      </div>
      <div
        ref={box} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} data-testid="email-body"
        onInput={() => onChange(box.current?.innerHTML ?? "")}
        className="min-h-[200px] rounded-b-xl border border-brand-gray bg-brand-surface p-3 text-sm text-brand-ink outline-none focus:border-brand-teal [&_a]:text-brand-teal [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc"
      />
    </div>
  );
});
export default RichEditor;
