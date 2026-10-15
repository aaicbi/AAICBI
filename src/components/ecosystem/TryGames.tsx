import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { visitorGames } from "@/lib/quest/visitorPlay";
import { FORMAT_INFO, type GameFormat } from "@/lib/quest/games";

/** "Try a game": short free rounds of games staff opened to visitors. Shows nothing when there are none (or if they cannot be read). */
export default async function TryGames() {
  const games = await visitorGames(4).catch(() => []);
  if (games.length === 0) return null;
  return (
    <section aria-label="Try a game" className="mt-4 rounded-3xl border border-brand-gray bg-card-gradient p-4" data-testid="try-games">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-ink"><Icon icon={Gamepad2} size="md" />Try a game</h2>
      <p className="mt-0.5 text-sm text-brand-ink">A ten-question round from our courses. Sign in or create a free account to play.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {games.map((g) => (
          <li key={g.id}>
            <Link href={`/play/${g.id}`} className="block min-h-[44px] rounded-2xl border border-brand-gray bg-brand-surface p-3 hover:border-brand-teal" data-testid="try-game-link">
              <span className="block text-sm font-semibold text-brand-ink">{FORMAT_INFO[g.format as GameFormat].label}: {g.moduleTitle}</span>
              <span className="mt-0.5 block text-xs text-gray-600">{g.courseTitle}</span>
              <span className="mt-1 block text-xs font-semibold text-brand-teal">Play a round</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
