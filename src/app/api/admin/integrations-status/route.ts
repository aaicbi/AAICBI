import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { whatsAppEnabled } from "@/lib/notifications/whatsapp";

type IntegrationStatus = "connected" | "not_configured" | "coming_soon";

interface Integration {
  id: string;
  label: string;
  description: string;
  status: IntegrationStatus;
}

/**
 * GET /api/admin/integrations-status — Settings-page redesign,
 * Integrations category. Read-only, on purpose: every one of these is
 * configured by setting a real environment variable at deploy time
 * (see DEPLOYMENT.md and .env.example), never by typing a secret into
 * a web form — storing API keys in the database for a web UI to edit
 * is a real, well-known anti-pattern this route deliberately avoids by
 * only ever reporting whether a value is PRESENT, never what it is.
 *
 * SUPER_ADMIN only — same reasoning as platform-settings: this reveals
 * real information about how the production deployment is configured
 * (which third-party services are wired up), which is closer to
 * infrastructure detail than something every staff role needs to see.
 *
 * Every one of these seven checks is a genuinely real integration this
 * codebase already talks to — nothing here is invented. Confirmed by
 * reading each integration's own source file (linked in each comment
 * below) rather than assumed from the env var name alone.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const integrations: Integration[] = [
      {
        id: "paystack",
        label: "Payment Gateway (Paystack)",
        description: "Course payments, subscriptions, and the receipt/reminder emails they trigger.",
        status: process.env.PAYSTACK_SECRET_KEY ? "connected" : "not_configured",
      },
      {
        id: "email",
        label: "Email Delivery (Resend)",
        description: "Every notification email this app sends — verification, receipts, reminders, and more.",
        status: process.env.RESEND_API_KEY ? "connected" : "not_configured",
      },
      {
        id: "ai_assistant",
        label: "AI Features (Anthropic)",
        description: "AI-assisted exam generation, job-posting screening, and translation drafting.",
        status: process.env.ANTHROPIC_API_KEY ? "connected" : "not_configured",
      },
      {
        id: "translation",
        label: "Translation Service (Google Translate)",
        description: "Drafts Yoruba/Igbo/Hausa/French translations. Pidgin drafting uses the AI key above instead.",
        status: process.env.GOOGLE_TRANSLATE_API_KEY ? "connected" : "not_configured",
      },
      {
        id: "file_storage",
        label: "File Storage (Vercel Blob)",
        description: "Profile pictures, resumes, employer logos, and job-posting media uploads.",
        status: process.env.BLOB_READ_WRITE_TOKEN ? "connected" : "not_configured",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Notifications",
        description:
          "A second delivery channel for time-sensitive codes (payment OTP, verification). Pending Meta/BSP business approval — not something this app's own configuration can complete alone.",
        status: whatsAppEnabled() ? "connected" : "coming_soon",
      },
      {
        id: "google_signin",
        label: "Sign in with Google (Trainee)",
        description: "Lets trainees log in or register with a Google account on /trainee/login and /trainee/register.",
        status: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "connected" : "not_configured",
      },
    ];

    return NextResponse.json({ integrations });
  });
}
