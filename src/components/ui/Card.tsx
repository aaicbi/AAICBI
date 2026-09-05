/**
 * The shared Card — a consistent container for anything that reads as
 * "a unit of content" (a module row, a stat, a settings panel). Three
 * variants for the three registers this app actually needs: quiet
 * default UI, a warm highlighted state for something worth noticing,
 * and a celebratory gold state reserved for genuine achievement
 * moments (earning a certificate, passing an assessment) — using gold
 * anywhere else would cheapen the one place it should mean something.
 *
 * Audit finding, closed here: `bg-white` was hardcoded with no dark
 * variant — the single most common UI element in this entire app
 * simply didn't participate in dark mode at all. `bg-brand-surface`
 * resolves to the exact same white in light mode (zero visual change
 * there) but to a genuine, distinct dark surface color in dark mode —
 * see that token's own comment in globals.css for why a card needs a
 * different value than the page background it sits on, not the same
 * one. The celebratory gradient's endpoint moved from a hardcoded
 * `to-white` to the same token for the identical reason — a bright
 * white patch inside an otherwise dark card would be exactly the kind
 * of jarring, half-themed moment this whole fix exists to remove.
 */
type CardVariant = "default" | "highlighted" | "celebratory";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /**
   * Opt-in hover-lift for cards that are genuinely clickable (a course
   * card, an opportunity card). Deliberately NOT the default: a static
   * settings panel or a stat card shouldn't animate on hover, because
   * that falsely signals "click me". Only cards that actually navigate
   * or open something should feel interactive — so the caller says so
   * explicitly, and everything else stays calm.
   */
  interactive?: boolean;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "border-brand-gray bg-brand-surface",
  highlighted: "border-brand-teal bg-brand-mint/40",
  celebratory: "border-brand-gold bg-gradient-to-br from-brand-goldLight/60 to-brand-surface",
};

export default function Card({
  variant = "default",
  interactive = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  // Design-pass — a real, restrained elevation system. Every card now
  // carries a soft resting shadow (shadow-sm) so it reads as a genuine
  // surface lifted off the page rather than a flat outlined box — the
  // single biggest "flat vs. crafted" difference, and subtle enough
  // never to feel heavy. `transition-shadow` is always on so the
  // resting state is calm and any hover change is smooth.
  //
  // Interactive cards additionally lift on hover: a slightly stronger
  // shadow and a 2px rise (-translate-y-0.5), fast and gentle, using
  // the transition infrastructure already in the app. This is the
  // "alive and responsive" feel premium products have — but only
  // where a card is actually clickable (see the `interactive` prop's
  // own comment for why it's opt-in, not default).
  const elevation = interactive
    ? "shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    : "shadow-sm transition-shadow";
  return (
    <div
      className={`rounded-xl border p-5 ${elevation} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
