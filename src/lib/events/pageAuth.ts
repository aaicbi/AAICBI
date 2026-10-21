import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { actorOf, assertEnabled, opensManager, type Actor } from "@/lib/events/eventsAccess";

/** For the Event Manager pages: the signed-in manager of the right kind, or a redirect. The server re-checks every action regardless. */
export async function managerPage(kind: "platform" | "organization", need?: string): Promise<Actor> {
  const session = await getSession();
  if (!session) redirect("/login");
  const a = await actorOf(session);
  if (!a || (kind === "platform") !== (a.kind !== "ORGANIZATION") || !opensManager(a.permissions, kind) || (need && !a.permissions.has(need))) redirect("/admin/dashboard");
  try { await assertEnabled(a); } catch { redirect("/admin/dashboard"); }
  return a;
}
