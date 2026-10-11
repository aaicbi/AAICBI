import Link from "next/link";
import type { Metadata } from "next";
import { Briefcase, Building2, GraduationCap, Landmark, type LucideIcon } from "lucide-react";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import Icon from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Log in", description: "Sign in to your AAICBI account." };

const KINDS: Array<{ title: string; text: string; icon: LucideIcon; login: string; forgot: string | null }> = [
  { title: "Trainee or founder", text: "Learners, professionals and startup founders.", icon: GraduationCap, login: "/trainee/login", forgot: "/trainee/forgot-password" },
  { title: "Training organization", text: "Institutions and programs that train people.", icon: Building2, login: "/org/login", forgot: null },
  { title: "Employer", text: "Companies and recruiters hiring talent.", icon: Briefcase, login: "/employer/login", forgot: null },
  { title: "Investor", text: "Investors and funds.", icon: Landmark, login: "/investor/login", forgot: null },
];

/** Only a local path may be carried through sign-in. Anything else (another site, a protocol-relative address) is dropped. */
function safeNext(raw: string | undefined): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : null;
}

/** One place to start signing in. Each card goes to the sign-in for that kind of account; the sign-in itself, and where it leads, are decided by the server. */
export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  const withNext = (href: string) => (next ? `${href}?next=${encodeURIComponent(next)}` : href);
  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-brand-ink">Log in</h1>
        <p className="mt-2 text-sm text-gray-700">Choose the kind of account you created. You will go to your own dashboard after signing in.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {KINDS.map((k) => (
            <li key={k.title} className="rounded-3xl border border-brand-gray bg-card-gradient p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mint text-brand-teal"><Icon icon={k.icon} size="md" /></span>
              <h2 className="mt-3 font-display text-lg font-semibold text-brand-ink">{k.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{k.text}</p>
              <Link href={withNext(k.login)} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Sign in</Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-gray-700">New here? <Link href="/join" className="font-semibold text-brand-teal hover:underline">Create an account</Link>. Not sure which kind you have? Try the one you registered with; each sign-in page has its own password reset.</p>
      </main>
    </>
  );
}
