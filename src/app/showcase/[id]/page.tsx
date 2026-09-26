"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";

interface ShowcaseProjectDetail {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  founderName: string;
  founderAvatarUrl: string | null;
  founderUsername: string | null;
}

/**
 * /showcase/[id] — the Community Showcase project detail view, fed by
 * the anonymous GET /api/showcase/[id]. See /showcase for the list
 * this is reached from.
 */
export default function ShowcaseProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ShowcaseProjectDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/showcase/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProject)
      .catch(() => setNotFound(true));
  }, [params.id]);

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Community Showcase", href: "/showcase" },
          { label: "Trainee Login", href: "/trainee/login" },
        ]}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        {notFound ? (
          <p className="text-sm text-gray-500">This project isn&apos;t available.</p>
        ) : project === null ? (
          <SkeletonList rows={3} />
        ) : (
          <Card>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{project.title}</h1>
            <div className="mt-2 flex items-center gap-2">
              {project.founderAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
                <img src={project.founderAvatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-mint text-xs font-semibold text-brand-teal">
                  {project.founderName.slice(0, 1).toUpperCase()}
                </span>
              )}
              {project.founderUsername ? (
                <a href={`/profile/u/${project.founderUsername}`} className="text-sm font-semibold text-brand-teal hover:underline">
                  by {project.founderName}
                </a>
              ) : (
                <span className="text-sm font-semibold text-gray-600">by {project.founderName}</span>
              )}
            </div>

            {project.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-700">{project.description}</p>}

            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block rounded-lg border border-brand-gray px-4 py-2 text-sm font-semibold text-brand-teal hover:border-brand-teal"
              >
                View Project →
              </a>
            )}
          </Card>
        )}
      </main>
    </>
  );
}
