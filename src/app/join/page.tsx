import Link from "next/link";
import type { Metadata } from "next";
import { Briefcase, Building2, GraduationCap, Landmark, Rocket, type LucideIcon } from "lucide-react";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import Icon from "@/components/ui/Icon";
import { ACCOUNT_TYPES, type AccountKey } from "@/lib/accounts/accountTypes";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Choose the kind of AAICBI account that fits you: Trainee, Training Organization, Employer, Investor or Startup.",
};

const ICONS: Record<AccountKey, LucideIcon> = { trainee: GraduationCap, organization: Building2, employer: Briefcase, investor: Landmark, startup: Rocket };

/**
 * The start of sign-up. Five kinds of account, each explained before anyone types a word: who it is for, what it can do,
 * what it asks for and what it cannot do. Each card goes to that account's own registration form, which keeps the kind
 * the person chose. Which account someone really has, and what they may do, is always decided by the server.
 */
export default function JoinPage() {
  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-tealDeep">Create an account</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-brand-ink sm:text-4xl">How will you take part?</h1>
        <p className="mt-3 max-w-2xl text-gray-700">Pick the kind of account that fits you. Each is free to create, and you can look around the ecosystem without one. Already registered? <Link href="/login" className="font-semibold text-brand-teal hover:underline">Log in</Link>.</p>

        <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ACCOUNT_TYPES.map((a) => (
            <li key={a.key} id={a.key} className="flex scroll-mt-28 flex-col rounded-3xl border border-brand-gray bg-card-gradient p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-surface text-brand-teal"><Icon icon={ICONS[a.key]} size="md" /></span>
              <h2 className="mt-3 font-display text-xl font-semibold text-brand-ink">{a.name}</h2>
              <p className="mt-1 text-sm font-semibold text-brand-tealDeep">{a.audience}</p>
              <p className="mt-2 text-sm text-gray-800">{a.summary}</p>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-700">What you can do</h3>
              <ul className="mt-1.5 space-y-1.5 text-sm text-brand-ink">{a.can.map((c) => <li key={c} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-action" /><span>{c}</span></li>)}</ul>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-700">What it asks for</h3>
              <ul className="mt-1.5 space-y-1.5 text-sm text-brand-ink">{a.needs.map((c) => <li key={c} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" /><span>{c}</span></li>)}</ul>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-700">Good to know</h3>
              <ul className="mt-1.5 space-y-1.5 text-sm text-gray-800">{a.limits.map((c) => <li key={c} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-500" /><span>{c}</span></li>)}</ul>

              <p className="mt-4 text-sm text-gray-800"><span className="font-semibold text-brand-ink">What happens next: </span>{a.next}</p>
              <div className="mt-auto pt-5">
                <Link href={a.href} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">{a.cta}</Link>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-gray-700">Not sure? Most people start as a <Link href="#trainee" className="font-semibold text-brand-teal hover:underline">Trainee</Link>. You can read more about the ecosystem on the <Link href="/about" className="font-semibold text-brand-teal hover:underline">About page</Link>.</p>
      </main>
    </>
  );
}
