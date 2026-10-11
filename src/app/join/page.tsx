import type { Metadata } from "next";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import JoinChooser from "@/components/landing/JoinChooser";

export const metadata: Metadata = { title: "Create an account", description: "Choose how you will use the AAICBI ecosystem and create your account." };

/** The start of sign-up. Each card goes to that kind of account's own registration. */
export default function JoinPage() {
  return (
    <>
      <HomeHeader />
      <JoinChooser />
    </>
  );
}
