import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaChatPage from "@/components/arena/ArenaChatPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Course chat" };

export default async function CourseChatPage({ params }: { params: { courseId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  return <ArenaChatPage courseId={params.courseId} traineeId={session.userId} />;
}
