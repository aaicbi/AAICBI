import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaLobby from "@/components/arena/ArenaLobby";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arena" };

export default async function CourseArenaPage({ params }: { params: { courseId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  return <ArenaLobby courseId={params.courseId} traineeId={session.userId} />;
}
