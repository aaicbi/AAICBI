import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTraineeProgressSurface } from "@/lib/trainee/progressSurface";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import ProgressSurface from "@/components/progress/ProgressSurface";

export const metadata = { title: "My Progress" };

/** The trainee's own pulled-together view of their AI feedback, courses and next step. */
export default async function TraineeProgressPage() {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  const data = await getTraineeProgressSurface(session.userId);

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">My Progress</h1>
        <p className="mt-1 text-sm text-gray-600">What the AI sees across your assessments, and what to do next.</p>
        <div className="mt-6">
          <ProgressSurface data={data} />
        </div>
      </main>
    </>
  );
}
