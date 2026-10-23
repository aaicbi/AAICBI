import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import RegisterForm from "@/components/crm/RegisterForm";
import { getRegisterPage } from "@/lib/crm/registration";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register for a course", robots: { index: false } };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null);

/** /register/<course>: the public pre-registration page. Shows the course, then a short form and the agreement. No account needed. */
export default async function RegisterPage({ params, searchParams }: { params: { id: string }; searchParams: { src?: string; play?: string } }) {
  const data = await getRegisterPage(params.id);
  if (!data) notFound();
  const { course } = data;

  // A player who saved their score in the taster has their email and number filled in. Only for the play on this very course.
  let prefill = { email: "", phone: "" };
  const play = typeof searchParams.play === "string" ? searchParams.play.slice(0, 80) : null;
  if (play) {
    const lead = await prisma.growthLead.findFirst({ where: { play: { token: play, campaign: { courseId: params.id } } }, select: { email: true, phone: true } });
    if (lead) prefill = { email: lead.email ?? "", phone: lead.phone ?? "" };
  }

  const start = when(course.startDate);
  const deadline = when(course.registrationDeadline);
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5"><Logo compact /><span className="rounded-full bg-brand-mint px-3 py-1 text-xs font-bold text-brand-teal">Pre-registration</span></header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        <section className="rounded-3xl bg-gradient-to-br from-[#013F39] to-[#016B61] p-6 text-white sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#F0B95B]">{data.state.open ? (start ? "Coming soon" : "Register your interest") : "Registration closed"}</p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{course.title}</h1>
          {data.organisationName && <p className="mt-1 text-sm text-white/80">With {data.organisationName}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            {start && <span className="rounded-full bg-[#F0B95B] px-3 py-1 text-[#0C241F]">Starts {start}</span>}
            {course.trainingFormat && <span className="rounded-full bg-white/15 px-3 py-1">{course.trainingFormat.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>}
            {course.durationDisplay && <span className="rounded-full bg-white/15 px-3 py-1">{course.durationDisplay}</span>}
            {course.modules.length > 0 && <span className="rounded-full bg-white/15 px-3 py-1">{course.modules.length} modules</span>}
            {deadline && data.state.open && <span className="rounded-full bg-white/15 px-3 py-1">Register by {deadline}</span>}
          </div>
          {course.description && <p className="mt-4 max-w-2xl text-sm text-white/90 sm:text-base">{course.description}</p>}
        </section>

        {(course.outcomes.length > 0 || course.modules.length > 0 || course.prerequisites.length > 0) && (
          <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-brand-gray/60 bg-card-gradient p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold text-brand-ink">What you will learn</h2>
            {course.outcomes.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-brand-ink">{course.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>}
            {course.modules.length > 0 && (
              <ol className="flex flex-col gap-2">
                {course.modules.map((m, i) => (
                  <li key={m.id} className="flex gap-3 rounded-xl border border-brand-gray/60 bg-brand-surface p-3 text-sm">
                    <span className="font-display font-bold text-brand-teal">{i + 1}</span>
                    <span className="text-brand-ink"><span className="font-semibold">{m.title}</span>{m.description && <span className="block text-brand-ink/75">{m.description}</span>}</span>
                  </li>
                ))}
              </ol>
            )}
            {course.prerequisites.length > 0 && <div><h3 className="text-sm font-bold text-brand-ink">Before you start</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-brand-ink">{course.prerequisites.map((p) => <li key={p}>{p}</li>)}</ul></div>}
            <p className="text-sm font-semibold text-brand-ink">{course.feeText}</p>
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-brand-gray/60 bg-card-gradient p-5 sm:p-6">
          {data.state.open && data.agreement ? (
            <RegisterForm courseId={course.id} courseTitle={course.title} agreement={data.agreement} src={typeof searchParams.src === "string" ? searchParams.src.slice(0, 80) : null} play={play} prefill={prefill} />
          ) : (
            <div className="flex flex-col gap-3" data-testid="register-closed">
              <h2 className="font-display text-xl font-bold text-brand-ink">{data.stateMessage ?? "Registration is not available right now."}</h2>
              <p className="text-sm text-brand-ink">You can still try a free course while you wait for the next one.</p>
              <ul className="flex flex-col gap-2">
                {data.suggestions.map((s) => (
                  <li key={s.id}><Link href={`/courses/${s.id}`} className="font-semibold text-brand-teal underline">{s.title}</Link></li>
                ))}
              </ul>
              <Link href="/courses" className="font-semibold text-brand-teal underline">See all courses</Link>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
