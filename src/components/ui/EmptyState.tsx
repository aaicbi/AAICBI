/**
 * A consistent shape for "there's nothing here yet" — with a slot for
 * one of the doodle illustrations (src/components/doodles/) instead of
 * the plain text messages every empty state used before. Per the
 * frontend-design skill: "an empty screen is an invitation to act,"
 * not just an absence — the doodle plus a clear next step is what
 * makes that true instead of just decorative.
 */
export default function EmptyState({
  illustration,
  title,
  description,
  action,
}: {
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-brand-gray bg-brand-sand/60 px-6 py-10 text-center">
      {illustration && <div className="mb-4 h-28 w-28">{illustration}</div>}
      <p className="font-display text-base font-semibold text-brand-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
