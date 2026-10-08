import type { EducationVideoCardData } from "@/components/ecosystem/EducationVideoCard";

/** Everything the landing page renders carries `isSample`, so a placeholder can never pass for real content. */
export interface Sampled {
  isSample: boolean;
}

export interface LandingProgram extends Sampled {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  level: string | null;
  duration: string | null;
  format: string | null;
  priceLabel: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  href: string;
  /** ISO time the program was published, for the activity strip. */
  at: string | null;
}

export interface LandingJob extends Sampled {
  id: string;
  title: string;
  company: string;
  summary: string;
  skills: string[];
  /** ISO closing date. */
  closingDate: string | null;
  href: string;
  at: string | null;
}

export interface LandingOrg extends Sampled {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  location: string | null;
  verified: boolean;
  featured: boolean;
  badges: string[];
  skills: string[];
  programCount: number;
  videoCount: number;
  href: string;
  at: string | null;
}

export interface LandingTrainee extends Sampled {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  location: string | null;
  openToWork: boolean;
  skills: string[];
  href: string;
  /** Seeds the drawn avatar when there is no photo. */
  avatarSeed: number;
}

export interface LandingEvent extends Sampled {
  id: string;
  title: string;
  /** ISO start time; null for a placeholder, which shows no date. */
  startsAt: string | null;
  locationText: string | null;
  organizationName: string;
  href: string;
}

export interface LandingVideo extends Sampled {
  card: EducationVideoCardData;
  href: string;
  at: string | null;
}

export type ActivityKind = "program" | "job" | "organization" | "video" | "event";

export interface ActivityItem extends Sampled {
  id: string;
  kind: ActivityKind;
  text: string;
  /** ISO time shown as "3 days ago"; null for samples. */
  at: string | null;
  href: string;
}

export interface SkillTrend {
  name: string;
  count: number;
}

/** Real counts only. A count of zero is never shown. */
export interface LandingStats {
  organizations: number;
  programs: number;
  jobs: number;
  videos: number;
  trainees: number;
}

export interface LandingReal {
  programs: LandingProgram[];
  jobs: LandingJob[];
  organizations: LandingOrg[];
  trainees: LandingTrainee[];
  events: LandingEvent[];
  videos: LandingVideo[];
  skills: SkillTrend[];
  stats: LandingStats;
}

/** What the page renders: real items first, labelled samples only where real content is thin. */
export interface LandingView extends LandingReal {
  activity: ActivityItem[];
  /** True when any placeholder is on the page, so a note can say so once. */
  hasSamples: boolean;
}
