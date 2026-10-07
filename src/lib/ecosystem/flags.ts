import { prisma } from "@/lib/prisma";

export interface EcosystemFlags {
  orgPages: boolean;
  education: boolean;
  feed: boolean;
}

/**
 * The public ecosystem is shipped dark: both switches live on the
 * PlatformSettings singleton and default to false, so deploying the code
 * (and its additive migration) changes nothing anyone can see until
 * SUPER_ADMIN turns a flag on in /admin/ecosystem. A missing settings
 * row, or any database error, reads as "off".
 */
export async function getEcosystemFlags(): Promise<EcosystemFlags> {
  try {
    const row = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: { ecosystemOrgPagesEnabled: true, ecosystemEducationEnabled: true, ecosystemFeedEnabled: true },
    });
    return {
      orgPages: !!row?.ecosystemOrgPagesEnabled,
      education: !!row?.ecosystemEducationEnabled,
      feed: !!row?.ecosystemFeedEnabled,
    };
  } catch {
    return { orgPages: false, education: false, feed: false };
  }
}
