"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

interface QuickAction {
  label: string;
  href: string;
  primary?: boolean;
}

/**
 * Personalized landing page — a role-aware action list. Deliberately
 * takes its actions as props rather than hardcoding a role switch
 * inside the component: each dashboard page decides its own list from
 * what that account can actually do (permissions already enforced by
 * the destination routes themselves), so this component can't
 * accidentally show an action a viewer doesn't have access to.
 *
 * Dashboard/Examination redesign — gained real expand/collapse: a
 * curated primary set renders immediately, the rest sits behind a
 * "Show more" toggle, following the exact same open/closed +
 * chevron-swap convention already established by
 * CourseOutlineAccordion.tsx (useState, aria-expanded, icon swap, not
 * a CSS rotate). Previously this always rendered every action at once
 * in a flat grid.
 */
export default function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0) return null;

  const primary = actions.filter((a) => a.primary !== false);
  const rest = actions.filter((a) => a.primary === false);
  const visible = expanded ? actions : primary;

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Icon icon={Zap} size="sm" /> Quick Actions
        </p>
        {rest.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 text-xs font-semibold text-brand-teal hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
            <Icon icon={expanded ? ChevronDown : ChevronRight} size="sm" />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-brand-gray px-3 py-2.5 text-center text-sm font-semibold text-brand-ink transition-colors hover:border-brand-teal hover:text-brand-teal"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
