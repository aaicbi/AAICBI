import { redirect } from "next/navigation";
import { whoAmI } from "@/lib/guide/server";
import { launchDestination, parseLaunchTarget } from "@/lib/pwa/launch";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** The installed app's start page: sends each kind of account to its own home (or the landing page when signed out). */
export default async function AppLaunchPage({ searchParams }: { searchParams: { to?: string } }) {
  const me = await whoAmI().catch(() => null);
  redirect(launchDestination(me, parseLaunchTarget(searchParams.to)));
}
