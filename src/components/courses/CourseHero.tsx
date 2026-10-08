"use client";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import Icon from "@/components/ui/Icon";
import ReadMore from "@/components/courses/ReadMore";

/**
 * The top of a course page: a large 16:9 picture (or a branded fallback),
 * badges, the title, who runs it, the category, a short overview, then
 * whatever status or action area the caller supplies. Used by both the
 * pre-enrollment page and the enrolled course page so they read the same.
 */
export default function CourseHero({
  title,
  imageUrl,
  publisher,
  category,
  badges,
  overview,
  onImageClick,
  children,
}: {
  title: string;
  imageUrl?: string | null;
  publisher?: string | null;
  category?: string | null;
  badges?: React.ReactNode;
  overview?: string | null;
  onImageClick?: () => void;
  children?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = imageUrl && !broken;
  const picture = showImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
    <img src={imageUrl as string} alt={`${title} cover`} decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover" />
  ) : (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-teal to-brand-tealDeep text-brand-onAccent" aria-hidden="true">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <Icon icon={GraduationCap} size="xl" className="relative h-12 w-12" />
    </div>
  );
  const frame = "relative aspect-video w-full overflow-hidden rounded-2xl border border-brand-gray bg-brand-mint shadow-md";
  return (
    <section className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start md:gap-8">
      {onImageClick && showImage ? (
        <button type="button" onClick={onImageClick} aria-label="View full-size picture" className={`${frame} block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal`}>
          {picture}
        </button>
      ) : (
        <div className={frame}>{picture}</div>
      )}
      <div className="min-w-0">
        {badges && <div className="mb-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
        <h1 className="break-words font-display text-2xl font-semibold leading-tight text-brand-ink [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
        {(publisher || category) && (
          <p className="mt-2 break-words text-sm text-gray-600 [overflow-wrap:anywhere]">
            {publisher && <span className="font-semibold text-brand-teal">{publisher}</span>}
            {publisher && category && <span aria-hidden="true"> · </span>}
            {category}
          </p>
        )}
        {overview && <ReadMore text={overview} className="mt-3" />}
        {children}
      </div>
    </section>
  );
}
