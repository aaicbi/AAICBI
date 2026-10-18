import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import { campaignBySlug } from "@/lib/growth/growth";
import ContinueClient from "@/components/growth/ContinueClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start Module 1" };

/** /play/<slug>/continue: after the taster, a newcomer lands here to open module 1. Signed-in trainees go straight in. Others are asked to create an account or sign in, and come back here. */
export default async function ContinuePage({ params }: { params: { id: string } }) {
  const campaign = await campaignBySlug(params.id);
  if (!campaign) notFound();
  return (
    <>
      <header className="mx-auto flex w-full max-w-md items-center justify-center px-4 pt-5"><Logo compact /></header>
      <main className="mx-auto w-full max-w-md px-4 py-5">
        <ContinueClient slug={params.id} courseTitle={campaign.course.title} />
        <p className="mt-4 text-center text-sm"><Link href={`/play/${params.id}`} className="font-semibold text-brand-teal underline">Back to my result</Link></p>
      </main>
    </>
  );
}
