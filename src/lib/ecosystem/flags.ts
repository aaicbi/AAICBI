import { prisma } from "@/lib/prisma";

export interface EcosystemFlags {
  orgPages: boolean;
  education: boolean;
  feed: boolean;
  /** Landing page ecosystem sections. Off = the original landing page. */
  landing: boolean;
  /** Labelled example placeholders where a section has little real content yet. */
  placeholders: boolean;
  /** Public job board (/jobs). Applying always needs an account. */
  publicJobs: boolean;
  /** Public trainee directory (/trainees). Only trainees who chose PUBLIC appear. */
  publicTrainees: boolean;
}

/** What the switches read as when the settings row is missing: the column defaults. */
export const DEFAULT_FLAGS: EcosystemFlags = {
  orgPages: true,
  education: true,
  feed: true,
  landing: true,
  placeholders: true,
  publicJobs: true,
  publicTrainees: true,
};

/** Every switch off, used when the database cannot be read. */
export const ALL_OFF: EcosystemFlags = {
  orgPages: false,
  education: false,
  feed: false,
  landing: false,
  placeholders: false,
  publicJobs: false,
  publicTrainees: false,
};

/**
 * The public ecosystem switches live on the PlatformSettings singleton
 * and default to on; SUPER_ADMIN can turn any of them off in
 * /admin/ecosystem. A missing settings row reads as the defaults; a
 * database error reads as "off", so a failing database never exposes a
 * page that was meant to be hidden.
 */
export async function getEcosystemFlags(): Promise<EcosystemFlags> {
  try {
    const row = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: {
        ecosystemOrgPagesEnabled: true,
        ecosystemEducationEnabled: true,
        ecosystemFeedEnabled: true,
        ecosystemLandingEnabled: true,
        ecosystemLandingPlaceholders: true,
        ecosystemPublicJobsEnabled: true,
        ecosystemPublicTraineesEnabled: true,
      },
    });
    if (!row) return DEFAULT_FLAGS;
    return {
      orgPages: row.ecosystemOrgPagesEnabled,
      education: row.ecosystemEducationEnabled,
      feed: row.ecosystemFeedEnabled,
      landing: row.ecosystemLandingEnabled,
      placeholders: row.ecosystemLandingPlaceholders,
      publicJobs: row.ecosystemPublicJobsEnabled,
      publicTrainees: row.ecosystemPublicTraineesEnabled,
    };
  } catch {
    return ALL_OFF;
  }
}
