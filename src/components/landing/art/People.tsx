/**
 * Drawn people for the landing page: a small, consistent flat style (the
 * same hand-drawn palette as src/components/doodles) so the page can show
 * who the ecosystem is for before real members have posted. Everything is
 * deterministic from a seed, so server and client always render the same
 * person. These are illustrations, not photographs, and every place they
 * stand in for real content is labelled "Example".
 */

const SKIN = ["#8D5A3B", "#A87050", "#C68B63", "#6F4630", "#E0B08A", "#5A3825"] as const;
const HAIR = ["#17120F", "#2B1D16", "#3A2A20"] as const;
const TOPS = ["#016B61", "#D99A34", "#B23A48", "#2F5D8A", "#85C79A", "#7A4E9C"] as const;
const WRAPS = ["#D99A34", "#B23A48", "#7A4E9C", "#2F5D8A"] as const;
const STYLES = ["short", "afro", "wrap", "bun", "braids"] as const;
type HairStyle = (typeof STYLES)[number];

export interface Look {
  skin: string;
  hair: string;
  top: string;
  wrap: string;
  style: HairStyle;
}

/** A person's look from a number. Different seeds give visibly different people. */
export function lookFor(seed: number): Look {
  const n = Math.abs(Math.floor(seed)) + 1;
  return {
    skin: SKIN[(n * 7) % SKIN.length],
    hair: HAIR[(n * 5) % HAIR.length],
    top: TOPS[(n * 3 + 1) % TOPS.length],
    wrap: WRAPS[(n * 11) % WRAPS.length],
    style: STYLES[(n * 13) % STYLES.length],
  };
}

function Hair({ look, behind }: { look: Look; behind: boolean }) {
  const { style, hair, wrap } = look;
  if (behind) {
    if (style === "afro") return <circle cx="0" cy="-3" r="13" fill={hair} />;
    if (style === "braids") return <path d="M-10 -2 L-11 14 M-6 -4 L-7 15 M10 -2 L11 14 M6 -4 L7 15" stroke={hair} strokeWidth="2.6" strokeLinecap="round" />;
    return null;
  }
  switch (style) {
    case "afro":
      return <path d="M-9 -1 C-9 -9 9 -9 9 -1 C5 -5 -5 -5 -9 -1Z" fill={hair} />;
    case "wrap":
      return (
        <g>
          <path d="M-10 -1 C-11 -14 11 -14 10 -1 C6 -6 -6 -6 -10 -1Z" fill={wrap} />
          <ellipse cx="6" cy="-12" rx="5" ry="3.2" fill={wrap} transform="rotate(-20 6 -12)" />
        </g>
      );
    case "bun":
      return (
        <g>
          <circle cx="0" cy="-13" r="4.2" fill={hair} />
          <path d="M-9 -1 C-9 -12 9 -12 9 -1 C6 -6 -6 -6 -9 -1Z" fill={hair} />
        </g>
      );
    case "braids":
      return <path d="M-9.5 -1 C-9.5 -12 9.5 -12 9.5 -1 C6 -6 -6 -6 -9.5 -1Z" fill={hair} />;
    default:
      return <path d="M-9 0 C-10 -12 10 -12 9 0 C7 -5 -5 -5 -9 0Z" fill={hair} />;
  }
}

function Head({ look }: { look: Look }) {
  return (
    <g>
      <Hair look={look} behind />
      <rect x="-2.6" y="6" width="5.2" height="6" rx="2" fill={look.skin} />
      <circle cx="0" cy="0" r="9" fill={look.skin} />
      <Hair look={look} behind={false} />
      <circle cx="-3.2" cy="0.4" r="0.95" fill="#17120F" />
      <circle cx="3.2" cy="0.4" r="0.95" fill="#17120F" />
      <path d="M-2.6 4 Q0 6.4 2.6 4" stroke="#17120F" strokeWidth="0.9" strokeLinecap="round" fill="none" />
    </g>
  );
}

/**
 * A whole person, origin at the centre of the head. `pose`:
 *  - "stand": full length, arms by the sides
 *  - "sit": down to the waist (a desk or table hides the rest)
 *  - "point": standing, one arm raised toward the right
 *  - "greet": one arm out toward the right, ready to shake hands
 */
export function Person({ x, y, scale = 1, seed, pose = "sit", flip = false }: { x: number; y: number; scale?: number; seed: number; pose?: "stand" | "sit" | "point" | "greet"; flip?: boolean }) {
  const look = lookFor(seed);
  const legs = pose === "sit" ? null : (
    <g fill="#2A3B38">
      <rect x="-9" y="38" width="7.6" height="26" rx="2.5" />
      <rect x="1.4" y="38" width="7.6" height="26" rx="2.5" />
    </g>
  );
  const torsoBottom = pose === "sit" ? 30 : 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {legs}
      <path d={`M-13 14 Q-13 11 -9 11 L9 11 Q13 11 13 14 L14 ${torsoBottom} L-14 ${torsoBottom} Z`} fill={look.top} />
      {/* arms */}
      {pose === "point" ? (
        <g stroke={look.top} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M-12 15 L-14 32" />
          <path d="M12 15 L26 4" />
          <circle cx="27" cy="3" r="2.6" fill={look.skin} stroke="none" />
        </g>
      ) : pose === "greet" ? (
        <g stroke={look.top} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M-12 15 L-14 32" />
          <path d="M12 16 L26 26" />
          <circle cx="27.5" cy="27" r="2.8" fill={look.skin} stroke="none" />
        </g>
      ) : (
        <g stroke={look.top} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d={pose === "sit" ? "M-12 15 L-15 26 L-9 30" : "M-12 15 L-14 32"} />
          <path d={pose === "sit" ? "M12 15 L15 26 L9 30" : "M12 15 L14 32"} />
        </g>
      )}
      <Head look={look} />
    </g>
  );
}

/** A round avatar: head and shoulders on a tinted disc. */
export function PersonAvatar({ seed, size = 56, title }: { seed: number; size?: number; title?: string }) {
  const look = lookFor(seed);
  const tints = ["#E4EEE7", "#F6E8CC", "#F5E2E1", "#DCE8F2"] as const;
  const bg = tints[Math.abs(Math.floor(seed)) % tints.length];
  const clip = `av-${seed}-${size}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill={bg} />
        <g transform="translate(32 27) scale(1.55)">
          <path d="M-16 40 Q-16 13 -9 11 L9 11 Q16 13 16 40 Z" fill={look.top} />
          <Head look={look} />
        </g>
      </g>
    </svg>
  );
}
