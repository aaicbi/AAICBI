import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaEvent from "@/components/arena/ArenaEvent";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live event" };

export default async function EventPage({ params }: { params: { courseId: string; eventId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  return <ArenaEvent url={`/api/arena/events/${params.eventId}`} courseId={params.courseId} backHref={`/trainee/arena/${params.courseId}`} />;
}
