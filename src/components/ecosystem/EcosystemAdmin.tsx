"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Payload {
  flags: { ecosystemOrgPagesEnabled: boolean; ecosystemEducationEnabled: boolean; ecosystemFeedEnabled: boolean };
  organizations: Array<{ id: string; name: string; isDemo: boolean; publicProfile: { slug: string; publicEnabled: boolean; verified: boolean } | null }>;
  posts: Array<{ id: string; title: string; status: string; youtubeUrl: string; thumbnailUrl: string; traineeName: string; organizationName: string; isDemo: boolean }>;
}

export default function EcosystemAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/admin/ecosystem").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) showToast((await res.json().catch(() => ({}))).error ?? "That did not work.", "error");
    load();
  }

  if (loadError) return <ErrorState message="Could not load ecosystem settings." onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;
  const pending = data.posts.filter((p) => p.status === "PENDING_REVIEW");

  return (
    <div className="space-y-8">
      <Card className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Feature switches</h2>
        <p className="text-sm text-gray-600">Both are off until you turn them on. Turning one off hides the public pages again immediately; no data is deleted.</p>
        <Row label="Public organization pages (/organizations)" checked={data.flags.ecosystemOrgPagesEnabled} onChange={(v) => call("/api/admin/ecosystem", "PUT", { ecosystemOrgPagesEnabled: v })} />
        <Row label="Trainee education videos (/learn)" checked={data.flags.ecosystemEducationEnabled} onChange={(v) => call("/api/admin/ecosystem", "PUT", { ecosystemEducationEnabled: v })} />
        <Row label="Community feed (/feed)" checked={data.flags.ecosystemFeedEnabled} onChange={(v) => call("/api/admin/ecosystem", "PUT", { ecosystemFeedEnabled: v })} />
      </Card>

      <section aria-labelledby="orgs">
        <h2 id="orgs" className="font-display text-lg font-semibold text-brand-ink">Organizations</h2>
        <div className="mt-3 space-y-3">
          {data.organizations.map((o) => (
            <Card key={o.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-brand-ink">{o.name}</p>
                {o.isDemo && <Badge variant="neutral">Demo</Badge>}
                {o.publicProfile?.slug && <span className="text-xs text-gray-500">/organizations/{o.publicProfile.slug}</span>}
              </div>
              <Row label="Verified (videos publish instantly)" checked={!!o.publicProfile?.verified} onChange={(v) => call(`/api/admin/ecosystem/organizations/${o.id}`, "PUT", { verified: v })} />
              <Row label="Public page on" checked={!!o.publicProfile?.publicEnabled} onChange={(v) => call(`/api/admin/ecosystem/organizations/${o.id}`, "PUT", { publicEnabled: v })} />
            </Card>
          ))}
          {data.organizations.length === 0 && <p className="text-sm text-gray-600">No approved organizations.</p>}
        </div>
      </section>

      <section aria-labelledby="queue">
        <h2 id="queue" className="font-display text-lg font-semibold text-brand-ink">Videos awaiting review ({pending.length})</h2>
        <div className="mt-3 space-y-3">
          {pending.length === 0 && <p className="text-sm text-gray-600">Nothing waiting.</p>}
          {pending.map((p) => (
            <PostRow key={p.id} p={p} actions={[["approve", "Approve"], ["reject", "Reject"]]} onAct={(a) => call(`/api/admin/ecosystem/posts/${p.id}`, "POST", { action: a })} />
          ))}
        </div>
        <h2 className="mt-8 font-display text-lg font-semibold text-brand-ink">Published</h2>
        <div className="mt-3 space-y-3">
          {data.posts.filter((p) => p.status === "PUBLISHED").map((p) => (
            <PostRow key={p.id} p={p} actions={[["remove", "Pull video"]]} onAct={(a) => call(`/api/admin/ecosystem/posts/${p.id}`, "POST", { action: a })} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-brand-ink">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function PostRow({ p, actions, onAct }: { p: Payload["posts"][number]; actions: Array<[string, string]>; onAct: (action: string) => void }) {
  return (
    <Card className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
      <img src={p.thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-brand-ink">{p.title}</p>
        <p className="text-xs text-gray-600">{p.traineeName} · {p.organizationName} {p.isDemo && "· demo"}</p>
        <a href={p.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-teal hover:underline">Open on YouTube</a>
      </div>
      <div className="flex gap-2">
        {actions.map(([a, label]) => <Button key={a} size="sm" variant={a === "approve" ? "primary" : "secondary"} onClick={() => onAct(a)}>{label}</Button>)}
      </div>
    </Card>
  );
}
