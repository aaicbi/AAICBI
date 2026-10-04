import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { processConfirmedCharge } from "@/lib/paystack/reconcile";

const ReconcileSchema = z.object({ reference: z.string().min(1) });

/**
 * POST /api/org-billing/reconcile — mirrors
 * /api/courses/[id]/reconcile exactly (same idempotency-via-
 * PaystackEvent guard, same "recheck directly with Paystack instead of
 * waiting on a possibly-missed webhook" recourse), for a training
 * organization's own platform-fee payment instead of a trainee's course
 * payment.
 *
 * Deliberately calls getSession() directly, NOT requireRole — same
 * reasoning as org-billing/pay/route.ts: this route IS a gated
 * session's way to confirm the payment that lifts the gate, so routing
 * through requireRole's own billing check here would be self-defeating.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    const org = await findTrainingOrgByStaffUserId(session.userId);
    if (!org) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = ReconcileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A payment reference is required." }, { status: 400 });
    }
    const { reference } = parsed.data;

    const limitKey = `org-billing-reconcile:${org.id}`;
    const limited = await rateLimit(limitKey, 10, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again, or contact support." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const existingEvent = await prisma.paystackEvent.findUnique({
      where: { paystackReference_eventType: { paystackReference: reference, eventType: "charge.success" } },
    });
    if (existingEvent) {
      return NextResponse.json({
        status: "already_processed",
        message: "This payment has already been processed. Your access should already be active.",
      });
    }

    try {
      await prisma.paystackEvent.create({
        data: { paystackReference: reference, eventType: "charge.success", payload: { source: "manual-reconciliation", triggeredBy: org.id } },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({
          status: "already_processed",
          message: "This payment has already been processed. Your access should already be active.",
        });
      }
      throw e;
    }

    const result = await processConfirmedCharge(reference);

    if (result.status !== "platform_fee") {
      // Submitted a reference that isn't a platform-fee charge at all
      // (e.g. a trainee's course payment reference) — same honest, no
      // information leaked either way.
      return NextResponse.json({ error: "That reference doesn't match your organization's billing." }, { status: 400 });
    }

    switch (result.result.status) {
      case "invalid_organization":
        return NextResponse.json({ error: "We couldn't find a matching payment for that reference. Please contact support." }, { status: 404 });
      case "not_genuine":
        return NextResponse.json(
          { error: "That payment doesn't appear to have succeeded. If you believe this is wrong, please contact support." },
          { status: 400 }
        );
      case "granted":
        if (result.result.trainingOrganizationId !== org.id) {
          return NextResponse.json({ error: "That reference doesn't match your organization." }, { status: 400 });
        }
        return NextResponse.json({ status: "granted", message: "Payment confirmed — your access is active." });
    }
  });
}
