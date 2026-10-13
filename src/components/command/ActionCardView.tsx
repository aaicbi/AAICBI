"use client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { CheckCircle2, ShieldAlert, XCircle, Zap } from "lucide-react";

export interface ActionCardData {
  id: string;
  kind: string;
  summary: string;
  risk: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "FAILED";
  autoExecuted: boolean;
  result?: unknown;
  error?: string;
}

const TITLES: Record<string, string> = {
  save_learning_objectives: "Save learning objectives",
  generate_bank_questions: "Draft exam questions",
  run_bank_validation: "Validate pending questions",
  split_question_pools: "Split question pools",
  set_practice_settings: "Change practice settings",
  send_message: "Send a message",
  suspend_messaging: "Suspend messaging access",
  log_change_request: "Save a change request",
};

export function actionTitle(kind: string): string {
  return TITLES[kind] ?? kind.replace(/_/g, " ");
}

/** A short plain-words line about what an action did. */
export function describeResult(kind: string, result: unknown): string | null {
  const r = (result ?? {}) as Record<string, unknown>;
  if (kind === "save_learning_objectives") return `Saved ${r.saved ?? 0}${Number(r.skippedAsDuplicates) ? `, skipped ${r.skippedAsDuplicates} that already existed` : ""}.`;
  if (kind === "split_question_pools") return `${r.practice ?? 0} questions to practice, ${r.formal ?? 0} to the formal pool.`;
  if (kind === "set_practice_settings") return "Settings updated.";
  if (kind === "send_message") return `Sent to ${r.sentCount ?? 0}${Number(r.failedCount) ? `, ${r.failedCount} could not be delivered` : ""}.`;
  if (kind === "suspend_messaging") return r.alreadySuspended ? "They were already suspended." : "Messaging access suspended.";
  if (kind === "generate_bank_questions" || kind === "run_bank_validation") {
    const bits = Object.entries(r).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`);
    return bits.length ? bits.join(" · ") : typeof r.error === "string" ? r.error : "Done.";
  }
  return null;
}

export default function ActionCardView({ card, busy, onDecide }: { card: ActionCardData; busy: boolean; onDecide: (id: string, decision: "approve" | "reject") => void }) {
  const high = card.risk === "high";
  const outcome = card.status === "EXECUTED" ? describeResult(card.kind, card.result) : null;
  return (
    <div
      className={`my-3 rounded-2xl border p-4 ${card.status === "PENDING" ? "border-brand-teal bg-brand-mint/30" : "border-brand-gray bg-brand-surface"}`}
      data-testid="action-card"
      data-status={card.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon icon={high ? ShieldAlert : Zap} size="sm" className={high ? "text-brand-goldText" : "text-brand-teal"} />
        <p className="text-sm font-semibold text-brand-ink">{actionTitle(card.kind)}</p>
        {card.status === "PENDING" && <Badge variant="warning">Waiting for your approval</Badge>}
        {card.status === "EXECUTED" && <Badge variant="success">{card.autoExecuted ? "Done automatically" : "Done"}</Badge>}
        {card.status === "REJECTED" && <Badge variant="neutral">Declined</Badge>}
        {card.status === "FAILED" && <Badge variant="danger">Didn&apos;t work</Badge>}
        {high && card.status === "PENDING" && <Badge variant="neutral">Affects people</Badge>}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{card.summary}</p>
      {outcome && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-tealDeep">
          <Icon icon={CheckCircle2} size="sm" /> {outcome}
        </p>
      )}
      {card.status === "FAILED" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-rose">
          <Icon icon={XCircle} size="sm" /> {card.error}
        </p>
      )}
      {card.status === "PENDING" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDecide(card.id, "approve")} disabled={busy} loading={busy}>
            Approve and run
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDecide(card.id, "reject")} disabled={busy}>
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}
