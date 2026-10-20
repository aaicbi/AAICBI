import Link from "next/link";
import Card from "@/components/ui/Card";

/**
 * The one "you cannot open this" screen: clear and professional, says nothing about what is behind the door, and always offers a safe way
 * back. Used wherever a page is refused for lack of permission.
 */
export default function AccessDenied({ what, home = "/admin/dashboard", homeLabel = "Back to your dashboard" }: { what: string; home?: string; homeLabel?: string }) {
  return (
    <Card>
      <div role="alert" data-testid="access-denied">
        <p className="font-display text-lg font-semibold text-brand-ink">You don&apos;t have access to {what}</p>
        <p className="mt-2 text-sm text-gray-700">Your account is not set up to use this. If you think it should be, ask a Super Admin to give you the access you need.</p>
        <Link href={home} className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover">{homeLabel}</Link>
      </div>
    </Card>
  );
}
