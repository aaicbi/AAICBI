import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaEvent from "@/components/arena/ArenaEvent";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live event · big screen" };

/** The instructor's big screen: the bracket and the match being played, for a projector. */
export default async function EventScreenPage({ params }: { params: { id: string; eventId: string } }) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/login");
  return <ArenaEvent screen staff url={`/api/admin/courses/${params.id}/arena/events/${params.eventId}`} courseId={params.id} backHref={`/admin/courses/${params.id}`} />;
}
