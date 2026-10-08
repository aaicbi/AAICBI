import Link from "next/link";
import { ArrowRight, Briefcase, Building2, GraduationCap, Landmark, type LucideIcon } from "lucide-react";
import Icon from "@/components/ui/Icon";

const ROLES: Array<{ title: string; text: string; icon: LucideIcon; register: string; login: string }> = [
  { title: "I want to learn", text: "Join programs, earn verified certificates, and choose whether to be seen.", icon: GraduationCap, register: "/trainee/register", login: "/trainee/login" },
  { title: "I run training", text: "Put your programs, events and trainees' work in front of people looking for them.", icon: Building2, register: "/org/register", login: "/org/login" },
  { title: "I'm hiring", text: "Post roles and find people whose skills are backed by real evidence.", icon: Briefcase, register: "/employer/register", login: "/employer/login" },
  { title: "I invest", text: "Discover organizations and the pitches trainees choose to share.", icon: Landmark, register: "/investor/register", login: "/investor/login" },
];

/** The sign-up step: choose how you will use the ecosystem. Each card goes to that role's own registration. */
export default function JoinChooser() {
  return (
    <section id="join" aria-labelledby="join-heading" className="scroll-mt-20 border-t border-brand-gray">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h2 id="join-heading" className="font-display text-2xl font-semibold text-brand-ink">
          Join the ecosystem
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">Choose how you will use it. Creating an account is free, and you can look around without one.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <li key={r.title} className="flex flex-col rounded-2xl border border-brand-gray bg-brand-surface p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-mint text-brand-teal">
                <Icon icon={r.icon} size="md" />
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-brand-ink">{r.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{r.text}</p>
              <Link href={r.register} className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent transition-colors hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
                Create an account <Icon icon={ArrowRight} size="sm" />
              </Link>
              <Link href={r.login} className="mt-2 inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-brand-teal hover:underline">
                Already a member? Sign in
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
