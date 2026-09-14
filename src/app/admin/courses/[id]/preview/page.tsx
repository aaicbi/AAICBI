"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Badge from "@/components/ui/Badge";
import CourseMarketingView from "@/components/courses/CourseMarketingView";
import type { MarketingView } from "@/lib/courseMarketing";
import BackLink from "@/components/ui/BackLink";

/**
 * /admin/courses/[id]/preview — "Preview as Trainee," exactly what a
 * prospective trainee would see on the public/pre-enrollment course
 * page, reusing the same CourseMarketingView every real trainee-facing
 * and public surface renders. Fetches the staff-only preview route,
 * which deliberately ignores the course's publish status — this works
 * for a DRAFT course too.
 */
export default function CourseAdminPreviewPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<MarketingView | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/courses/${params.id}/preview`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setNotFound(true));
  }, [params.id]);

  return (
    <>
      <SiteHeader right={<LogoutButton />} />
      <div className="border-b border-brand-gray bg-brand-mint/30 px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Previewing as trainee</Badge>
            <span className="text-xs text-gray-600">This is exactly what a prospective trainee sees before enrolling.</span>
          </div>
          <BackLink href={`/admin/courses/${params.id}`}>Back to editor</BackLink>
        </div>
      </div>

      {notFound && <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-gray-600">Course not found.</p>}
      {!notFound && !data && <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-gray-400">Loading…</p>}
      {data && <CourseMarketingView data={data} />}
    </>
  );
}
