"use client";
import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import type { ItemFormat } from "@/lib/quest/games";
import type { WorkspaceItem } from "@/components/studio/studioTypes";

/** A readable summary of one item, per format. */
export function ItemSummary({ item }: { item: WorkspaceItem }) {
  const c = item.content as Record<string, unknown>;
  if (item.format === "MATCHING") {
    const pairs = (c.pairs as { left: string; right: string }[]) ?? [];
    return (
      <ul className="space-y-0.5 text-xs text-gray-700">
        {pairs.map((p) => (
          <li key={p.left}>
            <span className="font-medium text-brand-ink">{p.left}</span> → {p.right}
          </li>
        ))}
      </ul>
    );
  }
  if (item.format === "ORDERING") {
    const steps = (c.steps as string[]) ?? [];
    return (
      <div className="text-xs text-gray-700">
        <p className="font-medium text-brand-ink">{String(c.prompt ?? "")}</p>
        <ol className="mt-0.5 list-decimal pl-5">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    );
  }
  const options = (c.options as { text: string; outcome: string; correct: boolean }[]) ?? [];
  return (
    <div className="text-xs text-gray-700">
      <p className="font-medium text-brand-ink">{String(c.situation ?? "")}</p>
      <ul className="mt-0.5 space-y-0.5">
        {options.map((o) => (
          <li key={o.text}>
            {o.correct ? "✓ " : "· "}
            {o.text} <span className="text-gray-500">({o.outcome})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusBadge({ status }: { status: WorkspaceItem["status"] }) {
  if (status === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="neutral">Rejected</Badge>;
  return <Badge variant="warning">Draft</Badge>;
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Write an item by hand. Loop can draft them too, but a person can always write one. */
export default function ItemForm({
  format,
  objectives,
  busy,
  onSubmit,
}: {
  format: ItemFormat;
  objectives: { id: string; text: string }[];
  busy: boolean;
  onSubmit: (objectiveId: string, content: unknown) => Promise<boolean>;
}) {
  const [objectiveId, setObjectiveId] = useState(objectives[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [options, setOptions] = useState([
    { text: "", outcome: "" },
    { text: "", outcome: "" },
    { text: "", outcome: "" },
  ]);
  const [correct, setCorrect] = useState(0);

  async function submit() {
    let content: unknown;
    if (format === "MATCHING") {
      content = { prompt, pairs: lines(text).map((l) => { const [left, ...rest] = l.split("|"); return { left: (left ?? "").trim(), right: rest.join("|").trim() }; }) };
    } else if (format === "ORDERING") {
      content = { prompt, steps: lines(text) };
    } else {
      content = { situation: prompt, options: options.map((o, i) => ({ text: o.text, outcome: o.outcome, correct: i === correct })).filter((o) => o.text.trim()) };
    }
    const ok = await onSubmit(objectiveId, content);
    if (ok) {
      setPrompt("");
      setText("");
      setOptions([{ text: "", outcome: "" }, { text: "", outcome: "" }, { text: "", outcome: "" }]);
      setCorrect(0);
    }
  }

  if (objectives.length === 0) return <p className="text-xs text-gray-600">This module needs confirmed learning objectives before items can be written. Ask Loop to draft them from the module&apos;s materials.</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <Select label="For this objective" value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)} compact>
        {objectives.map((o) => (
          <option key={o.id} value={o.id}>
            {o.text.length > 70 ? `${o.text.slice(0, 67)}…` : o.text}
          </option>
        ))}
      </Select>
      {format === "MATCHING" && (
        <>
          <Input label="Instruction (optional)" value={prompt} onChange={(e) => setPrompt(e.target.value)} compact />
          <Textarea label="Pairs: one per line as term | meaning (3 to 6)" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </>
      )}
      {format === "ORDERING" && (
        <>
          <Input label="What are the steps for?" value={prompt} onChange={(e) => setPrompt(e.target.value)} compact />
          <Textarea label="Steps in the CORRECT order, one per line (3 to 8)" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </>
      )}
      {format === "SCENARIO" && (
        <>
          <Textarea label="The situation" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-700">Options (2 to 4). Mark the best one.</legend>
            {options.map((o, i) => (
              <div key={i} className="rounded-xl border border-brand-gray p-2">
                <label className="flex items-center gap-2 text-xs text-brand-ink">
                  <input type="radio" name="best-option" checked={correct === i} onChange={() => setCorrect(i)} className="accent-brand-teal" />
                  Best choice
                </label>
                <Input label={`Option ${i + 1}`} value={o.text} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} compact wrapperClassName="mt-1" />
                <Input label={`What happens if chosen`} value={o.outcome} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, outcome: e.target.value } : x)))} compact wrapperClassName="mt-1" />
              </div>
            ))}
          </fieldset>
        </>
      )}
      <Button type="submit" size="sm" loading={busy} disabled={busy}>
        Add (approved, since you wrote it)
      </Button>
    </form>
  );
}
