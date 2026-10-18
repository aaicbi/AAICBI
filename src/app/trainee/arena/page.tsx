import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { availabilityForCourse } from "@/lib/arena/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gaming Arena" };

/** Courses where the Arena is open for this trainee. */
export default async function ArenaIndex() {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");
  const rows = await prisma.courseEnrollment.findMany({
    where: { traineeId: session.userId, unlockedAt: { not: null }, accessRevokedAt: null },
    select: { course: { select: { id: true, title: true } } },
    take: 50,
  });
  const open: { id: string; title: string }[] = [];
  for (const r of rows) if ((await availabilityForCourse(r.course.id)).game) open.push(r.course);
  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-2xl font-bold">Gaming Arena</h1>
      <p className="mb-4 text-sm opacity-80">Challenge a coursemate to The Interview, a two-player question game.</p>
      {open.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm">The Arena isn&apos;t open for any of your courses right now. It opens when your platform, organization or instructor turns it on.</p>
      ) : (
        <ul className="grid gap-2">
          {open.map((c) => (
            <li key={c.id}><Link className="block rounded-xl border p-4 font-semibold" href={`/trainee/arena/${c.id}`}>{c.title} →</Link></li>
          ))}
        </ul>
      )}
    </main>
  );
}
