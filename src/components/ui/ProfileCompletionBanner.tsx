/**
 * Universal profile system, Phase 5 — the completion nudge shown on
 * each role's own profile page. Nothing here is ever a hard gate:
 * hidden entirely at 100%, otherwise a plain progress bar plus a short
 * list of what's missing, no blocking or forced fields.
 */
export default function ProfileCompletionBanner({ percent, missing }: { percent: number; missing: string[] }) {
  if (percent >= 100) return null;

  return (
    <div className="mt-6 rounded-xl border border-brand-gray bg-brand-mint/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-ink">Profile completion: {percent}%</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-gray/50">
        <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {missing.map((m) => (
            <li key={m} className="rounded-full border border-brand-gray px-2.5 py-1 text-xs text-gray-600">
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
