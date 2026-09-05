/**
 * Audit finding, closed here: every list-fetching page in this app
 * silently swallowed a genuine fetch failure into an empty array —
 * `.catch(() => setX([]))` — meaning a real server or network error
 * looked pixel-identical to "there are genuinely zero of these." A
 * trainee seeing "no introductions yet" had no way to tell whether
 * that was true or their connection just failed.
 *
 * Matches the same "human and useful, not a raw error" principle
 * `EmptyState` already applies to genuine emptiness — this is its
 * counterpart for a real failure: what happened, and a real retry
 * action, not just a message.
 */
export default function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-brand-roseLight bg-brand-roseLight/20 px-6 py-8 text-center">
      <p className="text-sm text-brand-rose">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-lg border border-brand-gray px-4 py-2 text-xs font-semibold text-brand-ink hover:border-brand-teal hover:text-brand-teal"
      >
        Try again
      </button>
    </div>
  );
}
