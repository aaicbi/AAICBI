/**
 * Course discounts — the one shared presentational piece for "here's
 * what this costs," used everywhere a price is shown to a trainee
 * (the marketing view's price row, upcoming-course cards, the
 * enrollment button). When a course has a discount, the original
 * price is struck through, the discounted price is shown in its
 * place, and a small "-N% OFF" badge marks it — never just a bare
 * number, so a discount is always visually obvious, not something you
 * have to do math to notice.
 */
function formatNaira(kobo: number): string {
  return (kobo / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
}

function intervalSuffix(billingInterval: string | null): string {
  return billingInterval === "MONTHLY" ? "/month" : billingInterval === "QUARTERLY" ? "/quarter" : billingInterval === "ANNUALLY" ? "/year" : "";
}

export default function PriceTag({
  priceKobo,
  discountPercent,
  effectivePriceKobo,
  billingInterval,
  size = "md",
}: {
  priceKobo: number;
  discountPercent: number | null;
  effectivePriceKobo: number | null;
  billingInterval: string | null;
  size?: "sm" | "md";
}) {
  const suffix = intervalSuffix(billingInterval);
  const hasDiscount = !!discountPercent && effectivePriceKobo != null && effectivePriceKobo < priceKobo;
  const priceTextSize = size === "sm" ? "text-sm" : "text-base";
  const originalTextSize = size === "sm" ? "text-xs" : "text-sm";

  if (!hasDiscount) {
    return (
      <span className={`font-semibold text-brand-ink ${priceTextSize}`}>
        {formatNaira(priceKobo)}
        {suffix}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className={`line-through text-gray-400 ${originalTextSize}`}>
        {formatNaira(priceKobo)}
        {suffix}
      </span>
      <span className={`font-semibold text-brand-tealDeep ${priceTextSize}`}>
        {formatNaira(effectivePriceKobo!)}
        {suffix}
      </span>
      <span className="rounded-full bg-brand-rose px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        -{discountPercent}% OFF
      </span>
    </span>
  );
}
