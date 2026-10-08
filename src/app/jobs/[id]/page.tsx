import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import SignupPromptButton from "@/components/landing/SignupPrompt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { openJobWhere } from "@/lib/landing/publicWhere";
import { closesIn } from "@/lib/landing/core";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return prisma.jobPosting.findFirst({
    where: { id, ...openJobWhere() },
    select: {
      id: true, title: true, description: true, closingDate: true,
      employer: { select: { companyName: true } },
      skills: { select: { skill: { select: { name: true } } } },
      media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, select: { id: true, url: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await load(params.id).catch(() => null);
  return job ? { title: `${job.title}, ${job.employer.companyName}`, description: `Open opportunity at ${job.employer.companyName}.` } : { title: "Opportunity" };
}

/**
 * /jobs/[id] — one open role, readable by anyone. The Apply button is where
 * an account is asked for: a visitor gets a short dialog explaining why, a
 * signed-in trainee is sent to the existing application flow (which asks
 * what to share), and other account types are told applications are for
 * trainees.
 */
export default async function PublicJobPage({ params }: { params: { id: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.publicJobs) notFound();
  const job = await load(params.id);
  if (!job) notFound();
  const session = await getSession();
  const closes = closesIn(job.closingDate.toISOString());

  return (
    <>
      <SiteHeader nav={[{ label: "Training", href: "/courses" }, { label: "Verify a Certificate", href: "/certificate" }]} />
      <EcosystemSubnav active="jobs" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <BackLink href="/jobs">All opportunities</BackLink>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand-teal">{job.employer.companyName}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-brand-ink">{job.title}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {closes ?? "Closed"} · closes {job.closingDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {job.skills.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {job.skills.map((s) => (
              <li key={s.skill.name}>
                <Badge variant="neutral">{s.skill.name}</Badge>
              </li>
            ))}
          </ul>
        )}

        {job.media.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {job.media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element -- employer-uploaded image of unknown size and host.
              <img key={m.id} src={m.url} alt="" loading="lazy" className="aspect-video w-full rounded-xl border border-brand-gray object-cover" />
            ))}
          </div>
        )}

        <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-gray-700">{job.description}</div>

        <section aria-labelledby="apply-heading" className="mt-10 rounded-2xl border border-brand-gray bg-brand-surface p-5">
          <h2 id="apply-heading" className="font-display text-lg font-semibold text-brand-ink">
            Interested in this role?
          </h2>
          {session?.role === "TRAINEE" ? (
            <>
              <p className="mt-1 text-sm text-gray-600">You are signed in. You will choose what to share with the employer when you apply.</p>
              <div className="mt-4">
                <Button href="/trainee/job-postings" size="lg">
                  Apply as a trainee
                </Button>
              </div>
            </>
          ) : session ? (
            <p className="mt-1 text-sm text-gray-600">Applications are made from trainee accounts. You can still read everything here.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-600">You can read every posting without an account. To apply, create a free one; it takes a minute.</p>
              <div className="mt-4">
                <SignupPromptButton
                  label="Apply for this role"
                  title="Create an account to apply"
                  reason={`Applying to ${job.employer.companyName} means sharing your profile and certificates with them, and you choose exactly what. That needs an account.`}
                  next={`/jobs/${job.id}`}
                />
              </div>
            </>
          )}
          <p className="mt-4 text-xs text-gray-600">
            Employer contact details are never shown here.{" "}
            <Link href="/jobs" className="font-semibold text-brand-teal underline underline-offset-2">
              See more opportunities
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
