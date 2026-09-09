/**
 * The shared on/off switch — introduced in the universal profile
 * system's Phase 4, which needed a couple more of these for visibility
 * controls. Every existing toggle across the settings pages was
 * hand-rolled inline (~10 copies of the same `role="switch"` markup);
 * new toggles go through this component instead of adding an eleventh
 * copy. Existing ones are left as-is here — retrofitting all of them
 * is a separate cleanup, not part of this feature.
 */
export default function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        checked ? "bg-brand-teal" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
