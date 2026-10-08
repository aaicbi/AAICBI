/**
 * Loop's face: the ecosystem guide, drawn in the same hand-made style as
 * the people on the landing page. A friendly guide in a gold head wrap
 * and a teal top, inside a ring (the loop). Not a robot and not a cartoon
 * mascot. The state changes only small things, all transform-based and all
 * switched off by the browser's reduced-motion setting:
 *   idle / minimized: a slow, small float and an occasional blink
 *   attention: a wave
 *   speaking: the mouth moves and a wave
 *   thinking: the head tilts and the eyes look up
 *   helpful: a check mark pops in
 */
export type LoopState = "idle" | "attention" | "speaking" | "thinking" | "helpful" | "minimized";

const SKIN = "#A87050";
const INK = "#16302B";
const TEAL = "#016B61";
const GOLD = "#D99A34";

export default function LoopFace({ state = "idle", size = 56, className = "" }: { state?: LoopState; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`loop-face ${className}`} data-state={state} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="loop-clip">
          <circle cx="32" cy="32" r="31" />
        </clipPath>
      </defs>
      <g clipPath="url(#loop-clip)">
        <rect width="64" height="64" fill="#E4EEE7" />
        <path d="M6 66 Q6 44 20 41 L44 41 Q58 44 58 66 Z" fill={TEAL} />
        <circle cx="32" cy="50" r="5" fill="none" stroke="#F6E8CC" strokeWidth="2.2" />
        <path d="M35.2 46.6 L37.8 45.4 L37 48.4" fill="none" stroke="#F6E8CC" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <g className="loop-head">
          <rect x="29" y="35" width="6" height="9" rx="3" fill={SKIN} />
          <circle cx="32" cy="26" r="15" fill={SKIN} />
          <path d="M17 25 C16 8 48 8 47 25 C42 17.5 22 17.5 17 25 Z" fill={GOLD} />
          <ellipse cx="44.5" cy="11" rx="7" ry="4.4" fill={GOLD} transform="rotate(-25 44.5 11)" />
          <g className="loop-eyes">
            <circle className="loop-eye" cx="26" cy="27" r="1.8" fill={INK} />
            <circle className="loop-eye" cx="38" cy="27" r="1.8" fill={INK} />
          </g>
          <path className="loop-mouth" d="M27.5 33 Q32 37 36.5 33" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g className="loop-hand">
          <path d="M50 58 L52 46" stroke={TEAL} strokeWidth="6" strokeLinecap="round" />
          <circle cx="52.5" cy="43" r="4.2" fill={SKIN} />
        </g>
        <g className="loop-check">
          <circle cx="51" cy="13" r="8" fill={TEAL} />
          <path d="M47 13 L50 16 L55.5 9.5" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <circle cx="32" cy="32" r="30.5" fill="none" stroke={TEAL} strokeWidth="2.4" />
    </svg>
  );
}
