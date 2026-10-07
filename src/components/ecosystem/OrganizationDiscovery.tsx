"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { BADGE_LABELS, type BadgeKey } from "@/lib/ecosystem/visibilityCore";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";

interface Org {
  id: string; name: string; slug: string; logoUrl: string | null; tagline: string | null; location: string | null;
  verified: boolean; featured: boolean; badges: BadgeKey[]; skills: string[]; programCount: number; videoCount: number; watching: boolean;
}

/**
 * Organizations with a public page, for approved employers and investors.
 * Employers search by skill and jump to matching trainees; investors keep
 * a private watch list. Same component, role decides the action.
 */
export default function OrganizationDiscovery({ role }: { role: "EMPLOYER" | "INVESTOR" }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [state, setState] = useState<"ok" | "error" | "unavailable">("ok");
  const [skill, setSkill] = useState("");
  const [applied, setApplied] = useState("");
  const [watchOnly, setWatchOnly] = useState(false);
  const { showToast } = useToast();

  function load(q = applied) {
    setState("ok");
    fetch(`/api/ecosystem/organizations${q ? `?skill=${encodeURIComponent(q)}` : ""}`)
      .then((r) => {
        if (r.status === 404) { setState("unavailable"); return { organizations: [] }; }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((d) => setOrgs(d.organizations))
      .catch(() => setState("error"));
  }
  useEffect(() => load(""), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleWatch(o: Org) {
    const res = await fetch(`/api/investor/org-watchlist/${o.id}`, { method: o.watching ? "DELETE" : "PUT" });
    if (!res.ok) { showToast("Could not update your watch list.", "error"); return; }
    setOrgs((list) => (list ?? []).map((x) => (x.id === o.id ? { ...x, watching: !o.watching } : x)));
  }

  if (state === "unavailable") return <EmptyState title="Not available yet" description="Organization pages are not switched on yet. Check back soon." />;
  if (state === "error") return <ErrorState message="We couldn't load organizations." onRetry={() => load()} />;
  if (orgs === null) return <SkeletonList />;
  const shown = orgs.filter((o) => !watchOnly || o.watching);

  return (
    <div className="space-y-4">
      <Card>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(skill.trim()); setOrgs(null); load(skill.trim()); }}>
          <div className="min-w-[12rem] flex-1">
            <Input label="Skill taught, e.g. Data Analytics" hideLabel compact value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Skill taught, e.g. Data Analytics" />
          </div>
          <Button size="sm" type="submit">Search</Button>
          {applied && <button type="button" onClick={() => { setSkill(""); setApplied(""); setOrgs(null); load(""); }} className="text-xs font-semibold text-gray-500 hover:text-brand-teal">Clear</button>}
          {role === "INVESTOR" && (
            <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-600">
              <input type="checkbox" checked={watchOnly} onChange={(e) => setWatchOnly(e.target.checked)} /> Watching only
            </label>
          )}
        </form>
      </Card>
      {shown.length === 0 && <EmptyState title="No organizations match" description={applied ? "Try a different skill." : "Nothing here yet."} />}
      {shown.map((o) => (
        <Card key={o.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/organizations/${o.slug}`} className="font-display font-semibold text-brand-ink hover:text-brand-teal">{o.name}</Link>
            {o.featured && <Badge variant="success">Featured</Badge>}
            {o.verified && <VerifiedBadge compact />}
            {o.location && <span className="text-xs text-gray-500">{o.location}</span>}
          </div>
          {o.tagline && <p className="text-sm text-gray-700">{o.tagline}</p>}
          <p className="text-xs text-gray-600">{o.programCount} program{o.programCount === 1 ? "" : "s"} · {o.videoCount} video{o.videoCount === 1 ? "" : "s"}{o.badges.length > 0 && ` · ${o.badges.map((b) => BADGE_LABELS[b]).join(", ")}`}</p>
          {o.skills.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {o.skills.map((s) => (
                <li key={s} className="rounded-full border border-brand-gray px-2.5 py-1 text-xs text-brand-ink">
                  {role === "EMPLOYER" ? <Link href={`/employer/discover?skill=${encodeURIComponent(s)}`} className="hover:text-brand-teal" title={`Find trainees with ${s}`}>{s}</Link> : s}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/organizations/${o.slug}`} className="text-sm font-semibold text-brand-teal hover:underline">View page</Link>
            {role === "INVESTOR" && (
              <Button size="sm" variant={o.watching ? "secondary" : "primary"} aria-pressed={o.watching} onClick={() => toggleWatch(o)}>{o.watching ? "Watching" : "Watch"}</Button>
            )}
          </div>
        </Card>
      ))}
      {role === "EMPLOYER" && <p className="text-xs text-gray-500">Select a skill to see trainees who list it. Contact details stay private until a trainee accepts an introduction.</p>}
      {role === "INVESTOR" && <p className="text-xs text-gray-500">Your watch list is private; organizations cannot see who watches them.</p>}
    </div>
  );
}
