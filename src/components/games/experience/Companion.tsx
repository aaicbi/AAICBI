"use client";
import { Trophy } from "lucide-react";
import LoopFace, { type LoopState } from "@/components/guide/LoopFace";
import Icon from "@/components/ui/Icon";
import type { Achievement } from "@/lib/games/experience";

export type Mood = "idle" | "hello" | "cheer" | "cheerBig" | "support" | "think";

const FACE: Record<Mood, LoopState> = { idle: "idle", hello: "attention", cheer: "helpful", cheerBig: "attention", support: "speaking", think: "thinking" };

/**
 * Loop, the learner's guide through a round. Small and beside the words, never over the question or the answers. The words sit in
 * a live region so a screen reader announces them. An achievement takes over the same bubble for a few seconds, so nothing on the
 * page moves when one arrives.
 */
export default function Companion({ mood, message, messageKey, achievement, large = false }: { mood: Mood; message: string; messageKey: number; achievement: Achievement | null; large?: boolean }) {
  const tone = achievement ? "border-brand-gold bg-brand-goldLight text-brand-goldText" : mood === "cheer" || mood === "cheerBig" ? "border-brand-teal/40 bg-brand-mint text-brand-ink" : mood === "support" ? "border-brand-gray bg-brand-surface text-brand-ink" : "border-brand-gray bg-brand-surface text-brand-ink";
  return (
    <div className="flex items-start gap-3" data-testid="companion" data-mood={mood}>
      <div key={`${mood}-${messageKey}`} className={`shrink-0 ${mood === "cheerBig" ? "gx-streak" : ""}`}>
        <LoopFace state={FACE[mood]} size={large ? 72 : 48} />
      </div>
      <div key={messageKey} role="status" aria-live="polite" className={`gx-bubble min-h-[44px] flex-1 rounded-2xl rounded-tl-sm border px-3 py-2 text-sm ${tone} ${message || achievement ? "" : "invisible"}`} data-testid="companion-message">
        {achievement ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5" data-testid="achievement">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Icon icon={Trophy} size="sm" /> Achievement unlocked: {achievement.title}
            </span>
            <span className="text-xs">{achievement.detail}</span>
          </p>
        ) : (
          message || " "
        )}
      </div>
    </div>
  );
}
