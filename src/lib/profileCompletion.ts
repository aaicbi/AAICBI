/**
 * Universal profile system, Phase 5 — profile completion is a pure,
 * client-computable function of already-fetched data, not a stored
 * field: same "computed, not stored" discipline as isFreeEmailProvider
 * elsewhere in this app, avoiding a percentage that could silently
 * drift from the real profile the moment a field changes. Nothing
 * checked here is ever mandatory — this only ever informs an "Add
 * information" nudge, never blocks anything.
 */
export interface CompletionResult {
  percent: number;
  missing: string[];
}

function toResult(items: { label: string; done: boolean }[]): CompletionResult {
  const doneCount = items.filter((i) => i.done).length;
  return {
    percent: Math.round((doneCount / items.length) * 100),
    missing: items.filter((i) => !i.done).map((i) => i.label),
  };
}

export function computeTraineeCompletion(data: {
  avatarUrl: string | null;
  username: string | null;
  location: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  currentEmploymentStatus: string | null;
  resumeUrl: string | null;
  skillCount: number;
  educationCount: number;
  experienceOrProjectCount: number;
}): CompletionResult {
  return toResult([
    { label: "Add a profile picture", done: !!data.avatarUrl },
    { label: "Choose a username", done: !!data.username },
    { label: "Add your location", done: !!data.location },
    { label: "Add a professional link (LinkedIn, GitHub, or portfolio)", done: !!(data.linkedinUrl || data.githubUrl || data.portfolioUrl) },
    { label: "Set your employment status", done: !!data.currentEmploymentStatus },
    { label: "Add at least one skill", done: data.skillCount > 0 },
    { label: "Add your education", done: data.educationCount > 0 },
    { label: "Add work experience or a project", done: data.experienceOrProjectCount > 0 },
    { label: "Upload your resume/CV", done: !!data.resumeUrl },
  ]);
}

export function computeEmployerCompletion(data: {
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  description: string | null;
  hasSocialLink: boolean;
  activeVacancyCount: number;
}): CompletionResult {
  return toResult([
    { label: "Add a company logo", done: !!data.logoUrl },
    { label: "Add your industry", done: !!data.industry },
    { label: "Add company size", done: !!data.companySize },
    { label: "Add location", done: !!data.location },
    { label: "Add a company description", done: !!data.description },
    { label: "Add a website or social link", done: data.hasSocialLink },
    { label: "Post a vacancy", done: data.activeVacancyCount > 0 },
  ]);
}

export function computeAdminCompletion(data: {
  avatarUrl: string | null;
  username: string | null;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
  areasOfResponsibility: string | null;
}): CompletionResult {
  return toResult([
    { label: "Add a profile picture", done: !!data.avatarUrl },
    { label: "Choose a username", done: !!data.username },
    { label: "Add your job title", done: !!data.jobTitle },
    { label: "Add your department", done: !!data.department },
    { label: "Add a bio", done: !!data.bio },
    { label: "Add areas of responsibility", done: !!data.areasOfResponsibility },
  ]);
}
