import type { Metadata } from "next";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import AccountTypeBanner from "@/components/accounts/AccountTypeBanner";
import StartupRegisterForm from "@/components/accounts/StartupRegisterForm";

export const metadata: Metadata = { title: "Create a Startup account", description: "Create your founder account and your startup's profile together." };

export default function StartupRegisterPage() {
  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <AccountTypeBanner type="startup" />
        <StartupRegisterForm />
      </main>
    </>
  );
}
