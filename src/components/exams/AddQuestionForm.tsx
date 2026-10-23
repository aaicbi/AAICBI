"use client";
import { useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { MAX_OPTIONS, MIN_OPTIONS, questionDraftProblem } from "@/lib/exams/questionDraft";

interface Opt { text: string; isCorrect: boolean }
const blank = (): Opt[] => [0, 1, 2, 3].map(() => ({ text: "", isCorrect: false }));

/**
 * Write a question by hand into an exam, module assessment or course examination: the question, two to six options with one marked correct,
 * and optionally a topic, difficulty and an explanation. Mistakes show before saving; the server checks the same rules again. After saving the
 * form clears so the next question can be typed straight away.
 */
export default function AddQuestionForm({ examId, onAdded, defaultOpen = false }: { examId: string; onAdded: () => void | Promise<void>; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Opt[]>(blank());
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("BEGINNER");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad" | "note"; text: string } | null>(null);
  const first = useRef<HTMLTextAreaElement>(null);

  const problem = questionDraftProblem({ text, options, topic, explanation });
  const setOpt = (i: number, patch: Partial<Opt>) => setOptions((cur) => cur.map((o, j) => (j === i ? { ...o, ...patch } : patch.isCorrect ? { ...o, isCorrect: false } : o)));

  async function save() {
    if (problem) { setMsg({ kind: "bad", text: problem }); return; }
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/exams/${examId}/questions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, topic: topic.trim() || undefined, difficulty, explanation: explanation.trim() || undefined, options: options.filter((o) => o.text.trim()).map((o) => ({ text: o.text, isCorrect: o.isCorrect })) }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ kind: "bad", text: typeof j.error === "string" ? j.error : "We could not save that question. Check it and try again." }); return; }
    setText(""); setOptions(blank()); setTopic(""); setExplanation("");
    setMsg(j.needsReview ? { kind: "note", text: "Saved, but it looks like a duplicate of a question already here, so it needs review before you can publish." } : { kind: "ok", text: "Question saved. Type the next one." });
    await onAdded();
    first.current?.focus();
  }

  return (
    <Card className="mt-6" data-testid="add-question">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left" data-testid="add-question-toggle">
        <span><span className="block font-display text-lg font-semibold text-brand-ink">Write a question yourself</span><span className="block text-sm text-gray-600">No Word file needed. Type the question and its answers.</span></span>
        <span className="text-sm font-semibold text-brand-teal">{open ? "Close" : "Open"}</span>
      </button>
      {open && (
        <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <Textarea ref={first} label="Question" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} data-testid="aq-text" />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-bold text-brand-ink">Answer options <span className="font-normal text-gray-600">(tick the one correct answer)</span></legend>
            {options.map((o, i) => (
              <div key={i} className="flex items-start gap-2">
                <input type="radio" name="aq-correct" aria-label={`Option ${String.fromCharCode(65 + i)} is correct`} checked={o.isCorrect} onChange={() => setOpt(i, { isCorrect: true })} className="mt-3 h-5 w-5 shrink-0 accent-[var(--brand-teal,#016B61)]" data-testid={`aq-correct-${i}`} />
                <span className="mt-2.5 w-5 shrink-0 text-sm font-bold text-brand-ink" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                <div className="min-w-0 flex-1"><Input label={`Option ${String.fromCharCode(65 + i)}`} hideLabel value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} maxLength={500} data-testid={`aq-option-${i}`} /></div>
                {options.length > MIN_OPTIONS && <button type="button" aria-label={`Remove option ${String.fromCharCode(65 + i)}`} onClick={() => setOptions((cur) => cur.filter((_, j) => j !== i))} className="mt-1 min-h-[44px] rounded-full border border-brand-gray px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint">Remove</button>}
              </div>
            ))}
            {options.length < MAX_OPTIONS && <button type="button" onClick={() => setOptions((cur) => [...cur, { text: "", isCorrect: false }])} className="min-h-[44px] self-start rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" data-testid="aq-add-option">Add another option</button>}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} hint="Used in the trainee's performance summary." />
            <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option>
            </Select>
          </div>
          <Textarea label="Explanation (optional)" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={2000} hint="Shown with the correct answer when results show answers." />
          {msg && <p role={msg.kind === "bad" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${msg.kind === "bad" ? "border-brand-rose/40 bg-brand-roseLight text-brand-rose" : "border-brand-gray/60 bg-brand-surface text-brand-ink"}`} data-testid="aq-msg">{msg.text}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={busy} data-testid="aq-save">{busy ? "Saving…" : "Save question"}</Button>
            {problem && text.trim() && <span className="text-sm text-gray-600">{problem}</span>}
          </div>
        </form>
      )}
    </Card>
  );
}
