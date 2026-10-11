import Link from "next/link";
import { accountType, type AccountKey } from "@/lib/accounts/accountTypes";

/** Shown above each registration form so the person always knows which kind of account they are creating, and can change their mind. */
export default function AccountTypeBanner({ type }: { type: AccountKey }) {
  const a = accountType(type);
  return (
    <div className="mb-5 rounded-2xl border border-brand-teal bg-brand-mint/50 px-4 py-3 text-sm">
      <p className="font-semibold text-brand-ink">Creating a {a.name} account</p>
      <p className="mt-0.5 text-gray-700">{a.audience}</p>
      <Link href="/join" className="mt-1 inline-block font-semibold text-brand-teal hover:underline">Not the right kind? Compare the five account types</Link>
    </div>
  );
}
