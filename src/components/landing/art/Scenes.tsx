import { Person } from "@/components/landing/art/People";

/**
 * Environment illustrations for the landing page. Each is drawn on its own
 * tinted panel with a fixed palette, so it looks the same in the light and
 * dark themes and never has to be recoloured. They show what the
 * ecosystem is about (training, project work, employers meeting
 * trainees) until real members post their own content. Decorative by
 * default; pass `label` to give one a text alternative.
 */

const TEAL = "#016B61";
const TEAL_DEEP = "#014A43";
const GREEN = "#85C79A";
const MINT = "#E4EEE7";
const GOLD = "#D99A34";
const GOLD_LIGHT = "#F6E8CC";
const ROSE = "#B23A48";
const WALL = "#F2F6F1";
const FLOOR = "#CFE0D4";
const WOOD = "#B88A5A";
const WOOD_DARK = "#8F6A43";
const INK = "#16302B";

function Frame({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="260" fill={WALL} />
      {children}
    </svg>
  );
}

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-9 0 L9 0 L6 22 L-6 22 Z" fill={GOLD} />
      <path d="M0 0 C-10 -10 -14 -22 -6 -34 C-2 -26 0 -14 0 0Z" fill={TEAL} />
      <path d="M0 0 C10 -12 16 -20 12 -34 C4 -28 1 -14 0 0Z" fill={GREEN} />
      <path d="M0 0 C-2 -14 2 -26 0 -40 C6 -28 5 -12 0 0Z" fill={TEAL_DEEP} />
    </g>
  );
}

function Laptop({ x, y, w = 36 }: { x: number; y: number; w?: number }) {
  const h = w * 0.62;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx="2.5" fill={INK} />
      <rect x={-w / 2 + 3} y={-h + 3} width={w - 6} height={h - 6} rx="1.5" fill={GOLD_LIGHT} />
      <rect x={-w / 2 + 6} y={-h + 7} width={(w - 12) * 0.6} height="2.2" rx="1" fill={TEAL} />
      <rect x={-w / 2 + 6} y={-h + 12} width={(w - 12) * 0.8} height="2.2" rx="1" fill={GREEN} />
      <path d={`M${-w / 2 - 4} 0 L${w / 2 + 4} 0 L${w / 2} 4 L${-w / 2} 4 Z`} fill="#9AA7A2" />
    </g>
  );
}

/** A training room: an instructor at a board of charts, trainees at their laptops. */
export function LearningScene({ label, className }: { label?: string; className?: string }) {
  return (
    <Frame label={label} className={className}>
      {/* window */}
      <rect x="300" y="26" width="76" height="96" rx="4" fill="#CFE8F2" stroke={WOOD_DARK} strokeWidth="4" />
      <path d="M338 26 V122 M300 74 H376" stroke={WOOD_DARK} strokeWidth="3" />
      <circle cx="322" cy="50" r="9" fill={GOLD_LIGHT} />
      {/* board */}
      <rect x="28" y="28" width="196" height="108" rx="6" fill="#FFFFFF" stroke={TEAL} strokeWidth="4" />
      <g fill={TEAL}>
        <rect x="48" y="86" width="20" height="36" rx="2" />
        <rect x="76" y="68" width="20" height="54" rx="2" fill={GREEN} />
        <rect x="104" y="76" width="20" height="46" rx="2" />
        <rect x="132" y="52" width="20" height="70" rx="2" fill={GOLD} />
      </g>
      <path d="M44 126 H170" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
        <path d="M168 50 H206" />
        <path d="M168 62 H198" />
        <path d="M168 74 H208" />
      </g>
      {/* floor */}
      <rect y="196" width="400" height="64" fill={FLOOR} />
      <Plant x={372} y={196} s={0.9} />
      {/* instructor */}
      <Person x={262} y={96} scale={1.5} seed={8} pose="point" flip />
      {/* trainees at desks */}
      <Person x={92} y={150} scale={1.3} seed={3} />
      <Person x={196} y={150} scale={1.3} seed={14} />
      <Person x={300} y={152} scale={1.3} seed={21} />
      <g>
        <rect x="40" y="186" width="104" height="9" rx="3" fill={WOOD} />
        <rect x="148" y="186" width="104" height="9" rx="3" fill={WOOD} />
        <rect x="252" y="186" width="104" height="9" rx="3" fill={WOOD} />
        <Laptop x={92} y={186} />
        <Laptop x={196} y={186} />
        <Laptop x={300} y={186} />
        <rect x="46" y="195" width="6" height="52" fill={WOOD_DARK} />
        <rect x="136" y="195" width="6" height="52" fill={WOOD_DARK} />
        <rect x="154" y="195" width="6" height="52" fill={WOOD_DARK} />
        <rect x="240" y="195" width="6" height="52" fill={WOOD_DARK} />
        <rect x="258" y="195" width="6" height="52" fill={WOOD_DARK} />
        <rect x="344" y="195" width="6" height="52" fill={WOOD_DARK} />
      </g>
    </Frame>
  );
}

/** Project work: a team around a table with notes on the wall behind them. */
export function WorkshopScene({ label, className }: { label?: string; className?: string }) {
  const notes: Array<[number, number, string]> = [
    [44, 40, GOLD_LIGHT], [84, 36, "#DCEBDF"], [124, 44, "#F5E2E1"], [64, 78, "#DCE8F2"], [108, 82, GOLD_LIGHT],
    [250, 40, "#DCEBDF"], [292, 34, GOLD_LIGHT], [334, 44, "#F5E2E1"], [272, 80, "#DCE8F2"],
  ];
  return (
    <Frame label={label} className={className}>
      <rect x="24" y="22" width="130" height="86" rx="5" fill="#FFFFFF" stroke={WOOD_DARK} strokeWidth="3" />
      <rect x="234" y="22" width="130" height="86" rx="5" fill="#FFFFFF" stroke={WOOD_DARK} strokeWidth="3" />
      {notes.map(([x, y, c], i) => (
        <g key={i}>
          <rect x={x} y={y} width="28" height="26" rx="2" fill={c} />
          <path d={`M${x + 5} ${y + 8} H${x + 23} M${x + 5} ${y + 14} H${x + 19}`} stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        </g>
      ))}
      <rect y="206" width="400" height="54" fill={FLOOR} />
      <Plant x={30} y={206} s={1} />
      <Plant x={372} y={206} s={0.85} />
      {/* people behind and beside the table */}
      <Person x={118} y={134} scale={1.35} seed={5} />
      <Person x={200} y={124} scale={1.35} seed={17} pose="point" />
      <Person x={282} y={134} scale={1.35} seed={26} flip />
      {/* table */}
      <ellipse cx="200" cy="196" rx="140" ry="22" fill={WOOD} />
      <ellipse cx="200" cy="192" rx="140" ry="20" fill="#C9996A" />
      <rect x="194" y="210" width="12" height="38" fill={WOOD_DARK} />
      <Laptop x={130} y={192} w={32} />
      <Laptop x={276} y={192} w={32} />
      <rect x="180" y="184" width="40" height="10" rx="2" fill="#FFFFFF" />
      <path d="M186 188 H214" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
      <circle cx="232" cy="188" r="5" fill={GOLD} />
    </Frame>
  );
}

/** An employer and a trainee meeting, with a skyline behind them. */
export function EmployerScene({ label, className }: { label?: string; className?: string }) {
  return (
    <Frame label={label} className={className}>
      <rect x="0" y="0" width="400" height="206" fill="#DCEBF1" />
      {/* skyline */}
      <g fill="#B7CFC4">
        <rect x="18" y="86" width="44" height="120" />
        <rect x="70" y="56" width="52" height="150" />
        <rect x="132" y="98" width="36" height="108" />
        <rect x="236" y="70" width="48" height="136" />
        <rect x="294" y="104" width="40" height="102" />
        <rect x="344" y="62" width="44" height="144" />
      </g>
      <g fill="#FFFFFF" opacity="0.8">
        {[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => <rect key={`a${r}${c}`} x={78 + c * 14} y={68 + r * 24} width="8" height="12" rx="1" />))}
        {[0, 1, 2, 3].map((r) => [0, 1].map((c) => <rect key={`b${r}${c}`} x={244 + c * 18} y={82 + r * 24} width="9" height="12" rx="1" />))}
        {[0, 1, 2, 3, 4].map((r) => [0, 1].map((c) => <rect key={`c${r}${c}`} x={352 + c * 16} y={74 + r * 24} width="8" height="12" rx="1" />))}
      </g>
      <circle cx="338" cy="30" r="14" fill={GOLD_LIGHT} />
      {/* certificate on the wall */}
      <g transform="translate(176 36)">
        <rect width="62" height="44" rx="3" fill="#FFFFFF" stroke={GOLD} strokeWidth="3" />
        <path d="M10 14 H52 M10 22 H44" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="46" cy="32" r="6" fill={GOLD} />
        <path d="M43 36 L41 44 L46 41 L51 44 L49 36Z" fill={ROSE} />
      </g>
      <rect y="206" width="400" height="54" fill={FLOOR} />
      <Plant x={28} y={206} s={1.1} />
      {/* the meeting */}
      <Person x={150} y={124} scale={1.7} seed={9} pose="greet" />
      <Person x={248} y={124} scale={1.7} seed={30} pose="greet" flip />
      <circle cx="199" cy="168" r="6" fill="#A87050" />
      {/* laptop and bag on a side table */}
      <rect x="296" y="190" width="86" height="8" rx="3" fill={WOOD} />
      <Laptop x={322} y={190} w={32} />
      <rect x="344" y="176" width="20" height="14" rx="3" fill={ROSE} />
      <rect x="302" y="198" width="6" height="42" fill={WOOD_DARK} />
      <rect x="370" y="198" width="6" height="42" fill={WOOD_DARK} />
    </Frame>
  );
}

/** A small panel for a sample video thumbnail: a trainee presenting to camera. */
export function VideoScene({ seed, label, className }: { seed: number; label?: string; className?: string }) {
  return (
    <Frame label={label} className={className}>
      <rect width="400" height="260" fill={seed % 2 ? GOLD_LIGHT : MINT} />
      <rect x="50" y="34" width="120" height="76" rx="6" fill="#FFFFFF" stroke={TEAL} strokeWidth="3" />
      <g fill={seed % 2 ? GOLD : TEAL}>
        <rect x="66" y="78" width="14" height="22" rx="2" />
        <rect x="88" y="62" width="14" height="38" rx="2" fill={GREEN} />
        <rect x="110" y="70" width="14" height="30" rx="2" />
        <rect x="132" y="50" width="14" height="50" rx="2" fill={ROSE} />
      </g>
      <rect y="214" width="400" height="46" fill={FLOOR} />
      <Person x={268} y={118} scale={2.1} seed={seed} />
      <Plant x={352} y={214} s={1.1} />
    </Frame>
  );
}
