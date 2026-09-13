"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import CourseMarketingView from "@/components/courses/CourseMarketingView";
import type { MarketingView } from "@/lib/courseMarketing";

const NAV = [
  { label: "Courses", href: "/courses" },
  { label: "Trainee Login", href: "/trainee/login" },
];

/**
 * /courses/[id] — the genuinely public course marketing page, fed by
 * the anonymous GET /api/courses/public/[id]. No login required to
 * see it at all.
 *
 * The "am I already a trainee here" check is deliberately a second,
 * best-effort client-side call to the EXISTING authenticated
 * GET /api/courses/[id] rather than new server-side session logic on
 * the public route itself:
 *   - 401 (no session at all) -> stay here, show the login/sign-up CTA.
 *   - 403 (a real trainee session, just not enrolled yet) -> redirect
 *     to /trainee/courses/[id], which already has the full, tested
 *     Enroll/Pay-with-Paystack flow — not duplicated here.
 *   - 200 with `enrollmentStatus` present (an enrolled trainee's own
 *     view) -> redirect to the same page for the full experience.
 *   - 200 with no `enrollmentStatus` but a `createdById` (a staff
 *     member's own raw builder-shaped response — that's the one field
 *     always present on it and never on the trainee shape) -> redirect
 *     to the admin course builder. Bug fix: this used to be treated as
 *     a "rare, harmless edge case" and left alone, but it's exactly
 *     what a logged-in staff member visiting this page hits every
 *     time — they'd see "Log in to Enroll" despite already being
 *     logged in, which is the real complaint this fixes.
 */
export default function PublicCourseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<MarketingView | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/courses/public/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setNotFound(true));

    fetch(`/api/courses/${params.id}`)
      .then(async (r) => {
        if (r.status === 403) {
          router.replace(`/trainee/courses/${params.id}`);
          return;
        }
        if (r.ok) {
          const body = await r.json().catch(() => null);
          if (body && typeof body.enrollmentStatus === "string") {
            router.replace(`/trainee/courses/${params.id}`);
          } else if (body && typeof body.createdById === "string") {
            router.replace(`/admin/courses/${params.id}`);
          }
        }
      })
      .catch(() => {});
  }, [params.id, router]);

  if (notFound) {
    return (
      <>
        <SiteHeader nav={NAV} />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">Course not found.</main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <SiteHeader nav={NAV} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-6 w-40 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-3 h-8 w-72 animate-pulse rounded-full bg-brand-gray/60" />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} />
      <CourseMarketingView
        data={data}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`/trainee/login?next=/courses/${params.id}`}>Log in to Enroll</Button>
            <Button variant="secondary" href={`/trainee/register?next=/courses/${params.id}`}>
              New here? Sign up
            </Button>
          </div>
        }
      />
    </>
  );
}
