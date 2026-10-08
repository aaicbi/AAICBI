"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import Icon from "@/components/ui/Icon";

export interface CourseCardProps {
  href: string;
  title: string;
  /** Who runs it: the training organization, or AAICBI. */
  publisher?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  /** Status chips (Free, Paid, Beginner...). */
  badges?: React.ReactNode;
  /** Price or enrollment line. */
  price?: React.ReactNode;
  /** Small facts: category, module count... Missing ones are skipped. */
  meta?: (string | null | undefined | false)[];
  note?: React.ReactNode;
  cta?: string;
}

/** Shown when a course has no (or a broken) picture: the brand colors and mark, never an empty box. */
function FallbackImage({ title }: { title: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-brand-teal to-brand-tealDeep" aria-hidden="true">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="relative flex flex-col items-center gap-2 px-6 text-center text-brand-onAccent">
        <Icon icon={GraduationCap} size="xl" />
        <span className="line-clamp-2 break-words font-display text-sm font-semibold opacity-90">{title}</span>
      </div>
    </div>
  );
}

/**
 * The one course card for every list of courses: a large 16:9 picture,
 * then title, publisher, a short preview of the description, small facts,
 * and a call to action pinned to the bottom so buttons line up across a
 * row however long the text is. Long text is clamped (the full text lives
 * on the course page) and unbroken strings wrap instead of overflowing.
 */
export default function CourseCard({ href, title, publisher, description, imageUrl, badges, price, meta = [], note, cta = "View course" }: CourseCardProps) {
  const [broken, setBroken] = useState(false);
  const facts = meta.filter(Boolean) as string[];
  return (
    <Link
      href={href}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-brand-gray bg-brand-surface shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-brand-mint">
        {imageUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <FallbackImage title={title} />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        {badges && <div className="mb-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
        <h3 className="line-clamp-2 break-words font-display text-lg font-semibold leading-snug text-brand-ink [overflow-wrap:anywhere]">{title}</h3>
        {publisher && <p className="mt-1 line-clamp-1 break-words text-sm font-semibold text-brand-teal [overflow-wrap:anywhere]">{publisher}</p>}
        {description && <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-gray-600 [overflow-wrap:anywhere]">{description}</p>}
        {price && <div className="mt-3">{price}</div>}
        {note && <div className="mt-2">{note}</div>}
        {facts.length > 0 && <p className="mt-3 line-clamp-1 break-words text-xs text-gray-500">{facts.join(" · ")}</p>}
        <span className="mt-auto inline-flex items-center gap-1 self-end pt-4 text-sm font-semibold text-brand-teal">
          {cta} <Icon icon={ArrowRight} size="sm" className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
