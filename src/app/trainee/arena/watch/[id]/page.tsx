import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaWatch from "@/components/arena/ArenaWatch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watching a match" };

export default async function WatchPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  return <ArenaWatch matchId={params.id} />;
}
