/**
 * The celebration illustration — reserved specifically for the moment
 * a trainee actually earns something (a certificate, completing a
 * course). A hand-drawn laurel wreath, the one place gold is the
 * dominant color rather than an accent, so it keeps meaning
 * "achievement" instead of becoming just another decoration. Two
 * asymmetric branches (deliberately not mirror-perfect, since a hand
 * wouldn't draw them identically) curving up to a small burst at the
 * top — restrained enough to sit on an actual certificate without
 * looking like clip art.
 */
export default function AchievementDoodle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 140" fill="none" className={className} aria-hidden="true">
      {/* left branch */}
      <path
        d="M78 128 C 50 122, 32 108, 26 84 C 21 64, 28 46, 40 32"
        stroke="#D99A34"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {[...Array(6)].map((_, i) => {
        const t = i / 5;
        const x = 78 - t * 46;
        const y = 128 - t * 88;
        const rot = -30 - t * 40;
        return (
          <ellipse
            key={`l${i}`}
            cx={x}
            cy={y}
            rx="8"
            ry="4"
            fill={i % 2 === 0 ? "#85C79A" : "#016B61"}
            transform={`rotate(${rot} ${x} ${y})`}
            opacity={0.9}
          />
        );
      })}

      {/* right branch — asymmetric on purpose */}
      <path
        d="M82 128 C 108 120, 124 104, 128 82 C 131 63, 124 47, 114 34"
        stroke="#D99A34"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {[...Array(6)].map((_, i) => {
        const t = i / 5;
        const x = 82 + t * 44;
        const y = 128 - t * 90;
        const rot = 30 + t * 38;
        return (
          <ellipse
            key={`r${i}`}
            cx={x}
            cy={y}
            rx="8"
            ry="4"
            fill={i % 2 === 0 ? "#016B61" : "#85C79A"}
            transform={`rotate(${rot} ${x} ${y})`}
            opacity={0.9}
          />
        );
      })}

      {/* small burst at the top, where the wreath opens */}
      <g transform="translate(80, 24)">
        <circle r="9" fill="#D99A34" />
        <path d="M0 -16 L0 -10 M0 10 L0 16 M-16 0 L-10 0 M10 0 L16 0 M-11 -11 L-7 -7 M7 7 L11 11 M11 -11 L7 -7 M-7 7 L-11 11"
          stroke="#D99A34" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
