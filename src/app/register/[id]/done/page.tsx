import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import { getConfirmation } from "@/lib/crm/registration";

export const dynamic = "force-dynamic";
export const metadata = { title: "You are registered", robots: { index: false } };

/** The confirmation page. Shows only the course and the reference (nothing personal), the next steps and free courses to try meanwhile. */
export default async function DonePage({ params, searchParams }: { params: { id: string }; searchParams: { ref?: string } }) {
  const data = await getConfirmation(params.id, typeof searchParams.ref === "string" ? searchParams.ref : "");
  if (!data) notFound();
  const start = data.startDate ? new Date(data.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5"><Logo compact /><span className="rounded-full bg-brand-mint px-3 py-1 text-xs font-bold text-brand-teal">Registered</span></header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
        <section className="rounded-3xl border border-brand-gray/60 bg-card-gradient p-6" data-testid="register-done">
          <p className="font-bold text-brand-teal">✓ You are registered</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-brand-ink">{data.courseTitle}</h1>
          {data.organisationName && <p className="text-sm text-brand-ink/80">With {data.organisationName}</p>}
          {start && <p className="mt-1 text-sm text-brand-ink">Starts {start}</p>}
          <p className="mt-4 text-sm text-brand-ink/80">Your reference</p>
          <p className="font-display text-3xl font-bold tracking-wide text-brand-teal" data-testid="register-ref">{data.reference}</p>
          <h2 className="mt-5 text-lg font-bold text-brand-ink">What happens next</h2>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-brand-ink">
            <li>We will contact you by email and WhatsApp within 2 working days.</li>
            <li>We will share the start date and how to join.</li>
            <li>You will get a reminder before the course begins.</li>
          </ol>
          <p className="mt-3 text-sm text-brand-ink/80">Registering shows your interest. It is not admission, and we will confirm your place in writing. A copy of your signed agreement is in your email.</p>
        </section>
        {data.suggestions.length > 0 && (
          <section className="rounded-3xl border border-brand-gray/60 bg-card-gradient p-6">
            <h2 className="font-display text-xl font-bold text-brand-ink">Try a free course while you wait</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {data.suggestions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand-gray/60 bg-brand-surface p-3">
                  <span className="text-sm"><span className="font-semibold text-brand-ink">{s.title}</span><span className="block text-brand-ink/75">Free{s.durationDisplay ? ` · ${s.durationDisplay}` : ""}</span></span>
                  <Link href={`/courses/${s.id}`} className="inline-flex min-h-[44px] items-center rounded-full border border-brand-action px-4 text-sm font-semibold text-brand-action hover:bg-brand-mint">Start now</Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-brand-ink/80">Free courses need a free account. It takes about a minute.</p>
            <Link href="/trainee/register" className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-brand-action px-5 font-bold text-brand-onAccent hover:bg-brand-actionHover">Create my free account</Link>
          </section>
        )}
      </main>
    </>
  );
}
