import { unstable_cache } from "next/cache";
import { getEcosystemFlags, type EcosystemFlags } from "@/lib/ecosystem/flags";
import { loadEvents, loadJobs, loadOrganizations, safe } from "@/lib/landing/data";
import { publicStartups } from "@/lib/startups/startups";
import type { LandingEvent, LandingJob, LandingOrg } from "@/lib/landing/types";

/** How many of each the feed's side panels show. */
export const PANEL_SIZE = { organizations: 3, jobs: 3, startups: 3, events: 3 } as const;

export interface PanelStartup {
  id: string;
  name: string;
  tagline: string | null;
  industry: string | null;
  stage: string;
  logoUrl: string | null;
  verified: boolean;
  href: string;
}

/** Real content only: a panel with nothing to show is left out, never filled with examples. */
export interface DiscoveryPanels {
  organizations: LandingOrg[];
  jobs: LandingJob[];
  startups: PanelStartup[];
  events: LandingEvent[];
}

export function emptyPanels(): DiscoveryPanels {
  return { organizations: [], jobs: [], startups: [], events: [] };
}

/** Featured organizations first (they are what the super admin chose to put forward), then the rest in the existing order. */
export function pickOrganizations(orgs: LandingOrg[], n: number): LandingOrg[] {
  return [...orgs.filter((o) => o.featured), ...orgs.filter((o) => !o.featured)].slice(0, n);
}

export function hasPanels(p: DiscoveryPanels): boolean {
  return p.organizations.length + p.jobs.length + p.startups.length + p.events.length > 0;
}

async function loadStartups(): Promise<PanelStartup[]> {
  const rows = await publicStartups({ take: PANEL_SIZE.startups });
  return rows.map((r) => ({ id: r.id, name: r.name, tagline: r.tagline, industry: r.industry, stage: r.stage, logoUrl: r.logoUrl, verified: r.verified, href: r.handle ? `/@${r.handle}` : "/startups" }));
}

async function loadPanels(flagsJson: string): Promise<DiscoveryPanels> {
  const flags = JSON.parse(flagsJson) as EcosystemFlags;
  const [orgs, jobs, startups, events] = await Promise.all([
    flags.orgPages ? safe(loadOrganizations, { items: [], count: 0 }) : { items: [], count: 0 },
    flags.publicJobs ? safe(loadJobs, { items: [], count: 0 }) : { items: [], count: 0 },
    safe(loadStartups, []),
    flags.orgPages ? safe(loadEvents, []) : [],
  ]);
  return {
    organizations: pickOrganizations(orgs.items, PANEL_SIZE.organizations),
    jobs: jobs.items.slice(0, PANEL_SIZE.jobs),
    startups,
    events: events.slice(0, PANEL_SIZE.events),
  };
}

const cached = unstable_cache(loadPanels, ["discovery-panels-v1"], { revalidate: 300, tags: ["landing", "discovery"] });

/** Shared by everyone (nothing here depends on who is looking), refreshed every five minutes. A failure leaves the panels out. */
export async function getDiscoveryPanels(): Promise<DiscoveryPanels> {
  const flags = await safe(getEcosystemFlags, null);
  if (!flags) return emptyPanels();
  return safe(() => cached(JSON.stringify(flags)), emptyPanels());
}
