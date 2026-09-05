/**
 * For a locked module — deliberately muted and calm, not a "failure"
 * or "error" state. A locked module is a normal, expected part of
 * moving through a course in order, so this reads as "not yet," in
 * brand teal/gray, not red or alarming.
 */
export default function LockedDoodle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <path
        d="M35 44 C 34 30, 38 20, 50 20 S 66 30, 65 44"
        stroke="#3F6E7F"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="26" y="44" width="48" height="36" rx="6" fill="#E4EEE7" stroke="#016B61" strokeWidth="2.5" />
      <circle cx="50" cy="60" r="4" fill="#016B61" />
      <path d="M50 64 L50 70" stroke="#016B61" strokeWidth="2.5" strokeLinecap="round" />
      {/* a small dashed "path continues" mark, echoing the growth-path motif */}
      <path d="M78 62 C 84 62, 88 66, 88 72" stroke="#D9D9D9" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5" />
    </svg>
  );
}
