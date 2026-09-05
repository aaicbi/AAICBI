/**
 * The signature illustration motif for this pass: a hand-drawn winding
 * path with small sprouts along it, ending in a young plant — used
 * consistently across empty states ("nothing here yet, but here's
 * where it's going"). Extends AAICBI's own existing doodle-illustration
 * convention (already used in their course materials — hand-drawn
 * mockups, simple flat elements, brand palette) into the live product
 * for the first time, rather than inventing an unrelated style.
 *
 * Deliberately restrained: this is the ONE recurring motif, reused
 * rather than a different novelty doodle per empty state — per the
 * frontend-design skill's own guidance, "spend your boldness in one
 * place." A dashed/organic path (not a straight ruled line), rounded
 * hand-drawn strokes, and the brand palette are what make this read as
 * a doodle rather than a generic icon.
 */
export default function GrowthPathDoodle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* the winding path, hand-drawn dashes */}
      <path
        d="M12 100 C 28 92, 22 78, 38 74 S 54 60, 50 48 S 68 34, 66 22"
        stroke="#85C79A"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      {/* milestone dots along the path */}
      <circle cx="38" cy="74" r="3" fill="#D99A34" />
      <circle cx="50" cy="48" r="3" fill="#D99A34" />
      {/* small sprout at the base of the path */}
      <g transform="translate(8, 92)">
        <path d="M4 16 C 4 8, 4 4, 4 0" stroke="#016B61" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M4 8 C 1 6, -2 7, -3 4 C 1 4, 3 6, 4 8Z" fill="#85C79A" />
        <path d="M4 6 C 7 4, 10 5, 11 2 C 7 2, 5 4, 4 6Z" fill="#016B61" />
      </g>
      {/* the young plant at the end of the path — the "destination" */}
      <g transform="translate(58, 8)">
        <ellipse cx="8" cy="26" rx="10" ry="2.5" fill="#E4EEE7" />
        <path d="M8 26 L8 8" stroke="#016B61" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M8 14 C 3 11, 0 13, -1 8 C 4 8, 7 11, 8 14Z" fill="#85C79A" />
        <path d="M8 10 C 13 7, 16 9, 17 4 C 12 4, 9 7, 8 10Z" fill="#016B61" />
        <path d="M8 8 C 5 4, 6 1, 3 -2 C 7 -1, 9 3, 8 8Z" fill="#D99A34" />
      </g>
    </svg>
  );
}
