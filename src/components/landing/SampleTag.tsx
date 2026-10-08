/** The label every placeholder carries, so an example can never pass for real content. */
export default function SampleTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border border-dashed border-gray-400 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 ${className}`}>
      Example
    </span>
  );
}
