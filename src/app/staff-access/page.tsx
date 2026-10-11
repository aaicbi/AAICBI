import type { Metadata } from "next";
import StaffLoginForm from "@/components/admin/StaffLoginForm";

// Internal file behind the staff sign-in address. next.config.js rewrites the configured public path
// (STAFF_SIGN_IN_PATH) to here, and middleware answers 404 to anyone who asks for this path directly.
// Rendered on request so the form is in the first HTML, like the older /admin/login.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default function StaffAccessPage() {
  return <StaffLoginForm />;
}
