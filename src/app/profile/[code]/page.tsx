import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";

/**
 * M37 — the public shareable trainee profile, matching the exact
 * pattern `/certificate/[code]` already established in M15: no
 * authentication (the whole point — reachable via a link the trainee
 * generates and shares, never listed or searchable), rate-limited by
 * IP the same way, and the exact same "nothing sensitive is fetched
 * for it in the first place, not just hidden in the render"
 * discipline that page's own comment states — email and phone are
 * never selected into this query at all.
 *
 * Deliberately re-checks `publiclyDiscoverable` here too, not just at
 * generation time — the exact same "one toggle gates everything"
 * principle M30 established for employer browsing and M35 enforced
 * for the job board, applied a third time: a trainee turning
 * discoverability off should also disable an already-shared profile
 * link, not leave it working as some separate, inconsistent third
 * access path. A turned-off profile and a code that never existed
 * show the same "not found" message — the same "don't distinguish
 * doesn't-exist from exists-but-isn't-available" reasoning already
 * used for every ownership check in this project, so a guessed code
 * can't be used to confirm someone's discoverability status either
 * way.
 */
export default async function PublicProfilePage({ params }: { params: { code: string } }) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`profile-view:${ip}`, 60, 60 * 60 * 1000);

  if (!allowed) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-gray-600">Too many requests from this connection. Please try again in a few minutes.</p>
        </main>
      </>
    );
  }

  const trainee = await prisma.trainee.findUnique({
    where: { publicProfileCode: params.code.toUpperCase() },
    select: {
      name: true,
      discoverableHeadline: true,
      discoverableBio: true,
      publiclyDiscoverable: true,
      discoverableCertificates: {
        select: { certificate: { select: { code: true, course: { select: { title: true } } } } },
      },
    },
  });

  if (!trainee || !trainee.publiclyDiscoverable) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border border-brand-roseLight bg-brand-roseLight/40 p-8">
            <p className="text-3xl" aria-hidden="true">✕</p>
            <p className="mt-3 font-display text-lg font-semibold text-brand-rose">Profile Not Available</p>
            {/* Audit finding, closed here: this was a hardcoded hex
                (#8a2e39), not a theme token — dark, muted red text
                tuned for the light-mode background above it, but with
                no way to adapt when that same background shifted to
                its own dark-mode value, a dark red-brown tint. Dark
                text on a dark background is exactly the kind of
                contrast failure a hardcoded color can't self-correct
                from. `text-brand-rose` has real, distinct light/dark
                values already defined for exactly this purpose. */}
            <p className="mt-2 text-sm text-brand-rose">
              This profile link isn&apos;t currently active. It may have been regenerated or turned off by its owner.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-brand-gray bg-white dark:bg-brand-surface p-8 text-center shadow-sm sm:p-10">
          <Logo href={null} compact markClassName="h-11 w-11" className="justify-center" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-brand-teal">
            Africa&apos;s AI Capacity Building Initiative
          </p>
          <p className="mt-6 font-display text-2xl font-semibold text-brand-ink sm:text-3xl">{trainee.name}</p>
          {trainee.discoverableHeadline && (
            <p className="mt-2 text-sm text-gray-700">{trainee.discoverableHeadline}</p>
          )}
          {trainee.discoverableBio && <p className="mt-3 text-sm text-gray-600">{trainee.discoverableBio}</p>}

          {trainee.discoverableCertificates.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Certificates</p>
              <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                {trainee.discoverableCertificates.map((d: (typeof trainee.discoverableCertificates)[number]) => (
                  <li
                    key={d.certificate.code}
                    className="rounded-full bg-brand-mint px-3 py-1 text-xs font-medium text-brand-teal"
                  >
                    {d.certificate.course.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">
          Shared by {trainee.name} — this page is not listed or searchable.
        </p>
      </main>
    </>
  );
}
