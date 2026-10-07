"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Field";
import { COMPONENTS, COMPONENT_LABELS, DEFAULT_RANKING_CONFIG, BADGE_LABELS, type BadgeKey, type Component, type RankingConfig } from "@/lib/ecosystem/visibilityCore";

interface Payload {
  rankingConfig: RankingConfig;
  ratings: Array<{ id: string; name: string; score: number; components: Record<Component, number>; publishedVideos: number; badges: BadgeKey[]; featured: boolean }>;
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

      <PlatformAnalytics />

      <RankingSection config={data.rankingConfig} ratings={data.ratings} onSave={(c) => call("/api/admin/ecosystem", "PUT", { rankingConfig: c })} />

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

function RankingSection({ config, ratings, onSave }: { config: RankingConfig; ratings: Payload["ratings"]; onSave: (c: RankingConfig) => void }) {
  const [draft, setDraft] = useState(config);
  const num = (v: string) => Number(v);
  return (
    <section aria-labelledby="ranking" className="space-y-4">
      <h2 id="ranking" className="font-display text-lg font-semibold text-brand-ink">Organization visibility score</h2>
      <p className="text-sm text-gray-600">
        Rewards steady, good educational content, not volume: only complete published videos count, each organization&apos;s own trainees never lift its score, and at most the weekly cap of videos per week counts.
        The score is never shown publicly; organizations only see badges, and Featured follows the criteria below.
      </p>
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Weights (0 to 10)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COMPONENTS.map((c) => (
            <Input key={c} label={COMPONENT_LABELS[c]} type="number" min={0} max={10} step={0.5} value={draft.weights[c]} onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, [c]: num(e.target.value) } })} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input label="Videos counted per week" type="number" min={1} max={10} value={draft.weeklyPostCap} onChange={(e) => setDraft({ ...draft, weeklyPostCap: num(e.target.value) })} />
          <Input label="Weeks looked back" type="number" min={4} max={26} value={draft.windowWeeks} onChange={(e) => setDraft({ ...draft, windowWeeks: num(e.target.value) })} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Featured organizations</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input label="Minimum score (0 to 100)" type="number" min={0} max={100} value={draft.featured.minScore} onChange={(e) => setDraft({ ...draft, featured: { ...draft.featured, minScore: num(e.target.value) } })} />
          <Input label="Minimum recent videos" type="number" min={0} max={100} value={draft.featured.minPublishedVideos} onChange={(e) => setDraft({ ...draft, featured: { ...draft.featured, minPublishedVideos: num(e.target.value) } })} />
          <Input label="Most featured at once" type="number" min={1} max={12} value={draft.featured.maxFeatured} onChange={(e) => setDraft({ ...draft, featured: { ...draft.featured, maxFeatured: num(e.target.value) } })} />
        </div>
        <Row label="Only verified organizations can be featured" checked={draft.featured.requireVerified} onChange={(v) => setDraft({ ...draft, featured: { ...draft.featured, requireVerified: v } })} />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onSave(draft)}>Save</Button>
          <Button size="sm" variant="secondary" onClick={() => setDraft(DEFAULT_RANKING_CONFIG)}>Reset to defaults</Button>
        </div>
      </Card>
      <div className="space-y-2">
        {ratings.length === 0 && <p className="text-sm text-gray-600">No organizations with a public page yet.</p>}
        {ratings.map((r) => (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-brand-ink">{r.name}</p>
              <Badge variant="neutral">Score {r.score.toFixed(1)}</Badge>
              {r.featured && <Badge variant="success">Featured</Badge>}
              <span className="text-xs text-gray-500">{r.publishedVideos} recent video{r.publishedVideos === 1 ? "" : "s"}</span>
              {r.badges.map((b) => <span key={b} className="text-xs text-gray-600">· {BADGE_LABELS[b]}</span>)}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-3">
              {COMPONENTS.map((c) => <li key={c}>{COMPONENT_LABELS[c]}: {Math.round(r.components[c] * 100)}%</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

interface Analytics {
  days: number;
  totals: { profileViews: number; videoViews: number; programClicks: number; newFollows: number; videosPublished: number; publicOrganizations: number; enrollments: number };
  topOrganizations: Array<{ name: string; interactions: number }>;
}

function PlatformAnalytics() {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => {
    fetch("/api/admin/ecosystem/analytics").then((r) => (r.ok ? r.json() : null)).then(setA).catch(() => setA(null));
  }, []);
  if (!a) return null;
  const tiles: Array<[string, number]> = [
    ["Public organizations", a.totals.publicOrganizations], ["Videos published", a.totals.videosPublished], ["Page visits", a.totals.profileViews],
    ["Video views", a.totals.videoViews], ["Program clicks", a.totals.programClicks], ["New follows", a.totals.newFollows], ["Enrollments in organization programs", a.totals.enrollments],
  ];
  return (
    <section aria-labelledby="analytics" className="space-y-3">
      <h2 id="analytics" className="font-display text-lg font-semibold text-brand-ink">Last {a.days} days</h2>
      <p className="text-sm text-gray-600">Real organizations only; demo organizations are left out.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, n]) => <Card key={label}><p className="text-2xl font-semibold text-brand-ink">{n}</p><p className="text-xs text-gray-600">{label}</p></Card>)}
      </div>
      {a.topOrganizations.length > 0 && (
        <p className="text-sm text-gray-700">Most visited: {a.topOrganizations.map((o) => `${o.name} (${o.interactions})`).join(", ")}</p>
      )}
    </section>
  );
}
