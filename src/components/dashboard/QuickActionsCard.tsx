import Link from "next/link";
import Card from "@/components/ui/Card";

interface QuickAction {
  label: string;
  href: string;
}

/**
 * Personalized landing page — a role-aware action list. Deliberately
 * takes its actions as props rather than hardcoding a role switch
 * inside the component: each dashboard page decides its own list from
 * what that account can actually do (permissions already enforced by
 * the destination routes themselves), so this component can't
 * accidentally show an action a viewer doesn't have access to.
 */
export default function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;

  return (
    <Card className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Actions</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((a) => (
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
