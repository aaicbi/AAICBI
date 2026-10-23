import Logo from "@/components/Logo";
import CrmOptOutClient from "@/components/crm/OptOutClient";

export const metadata = { title: "Stop messages", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The private stop link in every CRM message. One tap stops all contact. */
export default function CrmOptOutPage({ params }: { params: { token: string } }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-md items-center justify-center px-4 pt-5"><Logo compact /></header>
      <main className="mx-auto w-full max-w-md px-4 py-5"><CrmOptOutClient token={params.token} /></main>
    </>
  );
}
