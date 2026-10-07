/**
 * Re-mounts on every navigation inside this area, so each new page
 * fades in instead of snapping. Opacity only: a transform here would
 * become the containing block for fixed-position children (dialogs,
 * floating buttons). Reduced-motion users get no animation through the
 * global prefers-reduced-motion rule in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-[page-in_0.2s_ease-out]">{children}</div>;
}
