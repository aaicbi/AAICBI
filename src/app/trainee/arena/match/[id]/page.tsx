import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ArenaMatch from "@/components/arena/ArenaMatch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Match" };

export default async function MatchPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  return <ArenaMatch matchId={params.id} />;
}
