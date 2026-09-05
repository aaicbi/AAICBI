import { forwardRef } from "react";
import Link from "next/link";

/**
 * The shared Button — replaces 29 separate files each hand-writing
 * their own `rounded-lg bg-brand-teal px-4 py-2...` string. One place
 * to get spacing, states, and the brand's interaction feel right,
 * used everywhere instead of copied everywhere.
 *
 * Accepts an optional `href` to render as a real link (Next.js
 * <Link>) instead of a <button> — same classes, same variants, correct
 * markup. Nesting a <button> inside an <a> (wrapping this component in
 * <Link> from the outside) is invalid HTML and a real accessibility
 * problem — this is the fix, not a workaround: the caller passes
 * `href` and gets a single, correctly-typed interactive element.
 */
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}
type ButtonAsButton = ButtonOwnProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "href"> & { href?: undefined };
type ButtonAsLink = ButtonOwnProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };
type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand-teal text-white hover:bg-brand-tealDeep disabled:bg-brand-gray disabled:text-gray-500",
  secondary:
    "border border-brand-gray text-brand-ink hover:border-brand-teal hover:text-brand-teal disabled:opacity-50",
  danger: "bg-brand-rose text-white hover:bg-[#96303c] disabled:bg-brand-gray disabled:text-gray-500",
  ghost: "text-brand-teal hover:bg-brand-mint disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className = "", children, ...rest }, ref) => {
    // Audit finding, closed here: no button anywhere in this app
    // marked itself non-selectable, so clicking or double-clicking a
    // button could trigger the browser's own text-selection caret —
    // confirmed directly as the real cause behind a reported "text
    // caret appears on buttons when clicked" bug, not a code-level
    // focus/contentEditable issue (there wasn't one). select-none here
    // fixes every button in the app at once, at the one shared
    // component every button already goes through.
    const classes = `inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;

    const spinner = loading && (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    );

    if ("href" in rest && rest.href) {
      const { href, ...anchorRest } = rest as ButtonAsLink;
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={classes}
          {...(anchorRest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {spinner}
          {children}
        </Link>
      );
    }

    const { disabled, ...buttonRest } = rest as ButtonAsButton;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled || loading}
        className={classes}
        {...buttonRest}
      >
        {spinner}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
