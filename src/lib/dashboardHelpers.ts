/**
 * Personalized landing page — small, pure helpers shared by all three
 * dashboards. `getTimeOfDayGreeting` extracts the exact logic
 * /trainee/dashboard already had inline (three-way split, computed
 * from server time) so it's no longer duplicated across pages.
 */
export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function formatLastVisit(date: Date | null): string | null {
  if (!date) return null;
  const day = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}
