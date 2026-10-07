import { COMPONENTS, COMPONENT_LABELS, type Component } from "@/lib/ecosystem/visibilityCore";

/** Share as a whole percent, or null when there is nothing to divide by (so the UI shows "n/a", never 0% or NaN). */
export function percent(part: number, whole: number): number | null {
  if (!whole || whole <= 0) return null;
  return Math.round((Math.min(part, whole) / whole) * 100);
}

export const TIPS: Record<Component, string> = {
  quality: "Add a description of at least a sentence, skill tags and a linked program to each video.",
  engagement: "Share your videos and public page; likes, saves and follows from people outside your own trainees count.",
  consistency: "Publish a video most weeks. A steady rhythm beats a burst of posts.",
  participation: "Feature different trainees; each new trainee voice counts, repeats do not.",
  achievements: "Issue certificates to trainees who complete your programs.",
  programs: "Tag every program with the skills it teaches so videos and employers can find it.",
};

/** The weakest parts of an organization's own score, as plain suggestions (at most `n`; none for parts already strong). */
export function improvementTips(components: Record<Component, number>, n = 3): Array<{ component: Component; label: string; tip: string }> {
  return [...COMPONENTS]
    .filter((c) => components[c] < 0.8)
    .sort((a, b) => components[a] - components[b])
    .slice(0, n)
    .map((c) => ({ component: c, label: COMPONENT_LABELS[c], tip: TIPS[c] }));
}

export function periodStart(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 3600 * 1000);
}
