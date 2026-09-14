import { Star } from "lucide-react";

/**
 * Replaces the `"★".repeat(rating)` renderer duplicated in the landing
 * page and admin testimonials page — both of which used a raw
 * non-token hex (#d4a017/#d1d5db) rather than this app's own brand-gold
 * token, fixed here as part of the swap.
 */
export default function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          width={16}
          height={16}
          aria-hidden="true"
          className={i < rating ? "fill-brand-gold text-brand-gold" : "fill-none text-brand-gray"}
        />
      ))}
    </span>
  );
}
