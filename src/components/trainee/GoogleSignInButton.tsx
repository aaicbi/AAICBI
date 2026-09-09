/**
 * Google sign-in — trainee-only (see the roadmap's own note on this
 * being deliberately deferred until now). A plain link, not a button
 * with an onClick handler: this has to be a real, top-level browser
 * navigation to /api/auth/google/start (which itself redirects to
 * Google), not a fetch() — an OAuth consent screen can't be reached
 * from behind an XHR/fetch call.
 *
 * The "G" mark below is Google's own standard four-color logo, used
 * per Google's own published branding guidelines for third-party
 * "Sign in with Google" buttons — this app has no icon library (every
 * other icon in the app is emoji), so this is the one deliberate
 * exception: Google's own guidelines are specific about reproducing
 * this exact mark, not a generic "G," for brand recognition and trust
 * signaling on an auth button.
 */
export default function GoogleSignInButton({
  intent,
  disabled = false,
}: {
  intent: "login" | "register";
  disabled?: boolean;
}) {
  const href = `/api/auth/google/start?intent=${intent}`;
  const label = intent === "register" ? "Sign up with Google" : "Sign in with Google";

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title="Agree to the Privacy Policy first"
        className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border border-brand-gray px-4 py-2.5 text-sm font-semibold text-gray-400"
      >
        <GoogleMark className="h-4 w-4 opacity-50" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-brand-gray px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:border-brand-teal hover:bg-brand-mint/30"
    >
      <GoogleMark className="h-4 w-4" />
      {label}
    </a>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
