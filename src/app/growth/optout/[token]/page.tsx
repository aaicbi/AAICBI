import Logo from "@/components/Logo";
import OptOutClient from "@/components/growth/OptOutClient";

export const metadata = { title: "Stop messages", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The private link in every message we send. One tap stops all contact. */
export default function OptOutPage({ params }: { params: { token: string } }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-md items-center justify-center px-4 pt-5"><Logo compact /></header>
      <main className="mx-auto w-full max-w-md px-4 py-5"><OptOutClient token={params.token} /></main>
    </>
  );
}
