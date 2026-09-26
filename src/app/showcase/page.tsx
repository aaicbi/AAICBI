"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface ShowcaseProject {
  id: string;
  title: string;
  description: string | null;
  founderName: string;
  founderAvatarUrl: string | null;
  founderUsername: string | null;
}

/**
 * /showcase — Pitch & Post, Phase 0: the genuinely public Community
 * Showcase, reachable with no login, fed by the anonymous
 * GET /api/showcase. Lists only the projects a trainee has explicitly
 * opted into with the "List in Community Showcase" toggle on their
 * own Profile — this page has no admin review gate, matching the
 * plan's Phase 0 scope.
 */
export default function CommunityShowcasePage() {
  const [projects, setProjects] = useState<ShowcaseProject[] | null>(null);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Courses", href: "/courses" },
          { label: "Trainee Login", href: "/trainee/login" },
        ]}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Community Showcase</h1>
        <p className="mt-1 text-sm text-gray-500">Real projects built by AAICBI trainees — shared here by their own choice.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects === null && <SkeletonList rows={4} />}

          {projects?.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState title="No projects listed yet" description="Check back soon, or add your own from your Profile." />
            </div>
          )}

          {projects?.map((p) => (
            <a key={p.id} href={`/showcase/${p.id}`}>
              <Card interactive className="h-full hover:border-brand-teal">
                <p className="font-display font-semibold text-brand-ink">{p.title}</p>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  {p.founderAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
                    <img src={p.founderAvatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-mint text-[10px] font-semibold text-brand-teal">
                      {p.founderName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-gray-600">by {p.founderName}</span>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
