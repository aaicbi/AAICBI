import type { Metadata } from "next";
import LegacyHome from "@/components/landing/LegacyHome";

// The earlier landing page, kept as the About page. Shared and cacheable, like it always was.
export const revalidate = 300;
export const metadata: Metadata = {
  title: "About AAICBI",
  description: "What AAICBI is, how it works, and how to join: Africa's AI Capacity Building Initiative.",
};

export default function AboutPage() {
  return <LegacyHome path="/about" />;
}
