import { CheckCircle2, XCircle } from "lucide-react";
import Icon from "./Icon";

/**
 * Replaces the `{o.isCorrect ? "✓ " : wasSelected ? "✕ " : ""}` (and
 * the `"· "` neutral variant) pattern duplicated across every
 * assessment/exam result and question-review page. Closes a real
 * accessibility gap along the way: the bare glyph carried no accessible
 * name at all — a screen reader announced nothing distinguishing
 * "correct" from "incorrect" beyond the surrounding color, which is a
 * WCAG 1.4.1 (color-alone) failure. `label` is required here on
 * purpose for exactly that reason.
 */
export default function CorrectnessMark({
  state,
  label,
}: {
  state: "correct" | "incorrect" | "neutral";
  label: string | undefined;
}) {
  if (state === "neutral") return null;
  const isCorrect = state === "correct";
  return (
    <span className={`inline-flex items-center ${isCorrect ? "text-brand-tealDeep" : "text-brand-rose"}`}>
      <Icon icon={isCorrect ? CheckCircle2 : XCircle} size="sm" label={label} />
    </span>
  );
}
