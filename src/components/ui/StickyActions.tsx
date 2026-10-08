/**
 * The row of a form's main buttons. On a phone it stays pinned to the
 * bottom of the screen (above the bottom navigation bar) so Save or Submit
 * is always one tap away however long the form is; on a larger screen it is
 * just a normal row after the form.
 */
export default function StickyActions({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`sticky z-20 -mx-4 flex items-center gap-3 border-t border-brand-gray bg-brand-surface px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 ${className}`}
      style={{ bottom: "var(--layer-nav, 0px)" }}
    >
      {children}
    </div>
  );
}
