import Link from "next/link";
import { Briefcase, Building2, CalendarDays, Flag, PlayCircle, Users, Video, Newspaper, Trophy } from "lucide-react";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Card from "@/components/ui/Card";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";

export const metadata = { title: "Explore" };
export const dynamic = "force-dynamic";

interface Tile {
  title: string;
  text: string;
  href: string;
  icon: typeof Briefcase;
  show: boolean;
}

/**
 * A trainee's way into the rest of the ecosystem, from inside their own
 * area: jobs, organizations, videos, events, other trainees. Pages the
 * platform has switched off are left out rather than shown as dead ends.
 */
export default async function TraineeExplorePage() {
  const f = await getEcosystemFlags();
  const tiles: Tile[] = [
    { title: "Jobs and opportunities", text: "See every open role. You need an account to apply, and you choose what to share.", href: "/jobs", icon: Briefcase, show: f.publicJobs },
    { title: "Training organizations", text: "Look at other organizations, follow the ones you like and see their programs.", href: "/organizations", icon: Building2, show: f.orgPages },
    { title: "Trainee videos", text: "Watch what other trainees have built and learned.", href: "/learn", icon: PlayCircle, show: f.education },
    { title: "Events", text: "Open days, workshops and demo days from organizations.", href: "/events", icon: CalendarDays, show: f.orgPages },
    { title: "Community feed", text: "The latest from across the ecosystem.", href: "/feed", icon: Newspaper, show: f.feed },
    { title: "Other trainees", text: "People who chose to share their profile publicly.", href: "/trainees", icon: Users, show: f.publicTrainees },
    { title: "Community Showcase", text: "Projects trainees have shared.", href: "/showcase", icon: Trophy, show: true },
  ].filter((t) => t.show);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainee/dashboard" }, { label: "Explore" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Explore the ecosystem</h1>
      <p className="mt-1 text-sm text-gray-600">Look around, find opportunities, and share your own work.</p>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              <Card className="h-full transition-colors hover:border-brand-teal">
                <t.icon aria-hidden="true" className="h-6 w-6 text-brand-teal" />
                <p className="mt-2 font-display font-semibold text-brand-ink">{t.title}</p>
                <p className="mt-1 text-sm text-gray-700">{t.text}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-lg font-semibold text-brand-ink">Your voice</h2>
      <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <li>
          <Link href="/trainee/videos" className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            <Card className="h-full transition-colors hover:border-brand-teal">
              <Video aria-hidden="true" className="h-6 w-6 text-brand-teal" />
              <p className="mt-2 font-display font-semibold text-brand-ink">Share a video</p>
              <p className="mt-1 text-sm text-gray-700">Post a YouTube video about what you learned. Your training organization reviews it, and you can send it to AAICBI if you have trouble.</p>
            </Card>
          </Link>
        </li>
        <li>
          <Link href="/trainee/report" className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            <Card className="h-full transition-colors hover:border-brand-teal">
              <Flag aria-hidden="true" className="h-6 w-6 text-brand-teal" />
              <p className="mt-2 font-display font-semibold text-brand-ink">Report a concern</p>
              <p className="mt-1 text-sm text-gray-700">Tell the Super Admin, in confidence, if an organization treated you badly.</p>
            </Card>
          </Link>
        </li>
      </ul>
    </main>
  );
}
