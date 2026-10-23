import Link from "next/link";
import Logo from "@/components/Logo";
import { freeCourseSuggestions } from "@/lib/crm/registration";

export const dynamic = "force-dynamic";
export const metadata = { title: "Try a free course", description: "Free courses you can start today." };

/** A short list of free published courses, for people who finished the taster game or are waiting for a course to start. */
export default async function FreeCoursesPage() {
  const courses = await freeCourseSuggestions({ excludeIds: [], category: null, limit: 12 });
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5"><Logo compact /><Link href="/courses" className="text-sm font-semibold text-brand-teal underline">All courses</Link></header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        <h1 className="font-display text-3xl font-bold text-brand-ink">Try a free course</h1>
        <p className="mt-1 text-sm text-brand-ink/80">Start learning today. Free courses need a free account, which takes about a minute.</p>
        {courses.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-brand-gray/60 bg-card-gradient p-5 text-sm text-brand-ink">There are no free courses right now. <Link href="/courses" className="font-semibold text-brand-teal underline">See all courses</Link>.</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3" data-testid="free-courses">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-gray/60 bg-card-gradient p-4">
                <span className="text-sm"><span className="font-semibold text-brand-ink">{c.title}</span><span className="block text-brand-ink/75">Free{c.durationDisplay ? ` · ${c.durationDisplay}` : ""}</span></span>
                <Link href={`/courses/${c.id}`} className="inline-flex min-h-[44px] items-center rounded-full border border-brand-action px-4 text-sm font-semibold text-brand-action hover:bg-brand-mint">Start now</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
