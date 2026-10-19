import { PYRAMID_BIG, PYRAMID_DOT, PYRAMID_HEIGHT, PYRAMID_PATH, PYRAMID_SMALL, PYRAMID_WIDTH, PYRAMID_WORD_X, PYRAMID_WORD_Y } from "@/components/brand/wordmark";

/** The AAICBI lockup in fixed light colours, for the Arena's always-dark stage (the normal Logo follows the site's light or dark theme, so it would vanish on the stage). */
export default function ArenaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${PYRAMID_WIDTH} ${PYRAMID_HEIGHT}`} className={className} role="img" aria-label="AAICBI">
      <polygon points={PYRAMID_BIG} fill="#f4fbf7" />
      <polygon points={PYRAMID_SMALL} fill="#7fd6a0" />
      <circle cx={PYRAMID_DOT.cx} cy={PYRAMID_DOT.cy} r={PYRAMID_DOT.r} fill="#f2b84b" />
      <path transform={`translate(${PYRAMID_WORD_X} ${PYRAMID_WORD_Y})`} d={PYRAMID_PATH} fill="#f4fbf7" />
    </svg>
  );
}
