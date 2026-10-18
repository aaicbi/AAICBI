import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaLadder from "@/components/arena/ArenaLadder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Champion ladder" };

export default async function CourseLadderPage({ params }: { params: { courseId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  return <ArenaLadder courseId={params.courseId} />;
}
