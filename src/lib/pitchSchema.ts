import { z } from "zod";
import { safeUrl } from "@/lib/materialUrl";

// Shared by POST /api/trainee/pitches and PATCH /api/trainee/pitches/[id].
// Next.js route files may only export HTTP method handlers (and a small
// allow-list of config values) — a shared schema can't live in one of
// them, hence this separate module.
export const PitchSchema = z.object({
  startupName: z.string().trim().min(1).max(160),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  problem: z.string().trim().max(4000).optional().or(z.literal("")),
  solution: z.string().trim().max(4000).optional().or(z.literal("")),
  targetMarket: z.string().trim().max(2000).optional().or(z.literal("")),
  businessModel: z.string().trim().max(2000).optional().or(z.literal("")),
  stage: z.string().trim().max(120).optional().or(z.literal("")),
  traction: z.string().trim().max(2000).optional().or(z.literal("")),
  teamDescription: z.string().trim().max(2000).optional().or(z.literal("")),
  pitchVideoUrl: safeUrl.optional().or(z.literal("")),
  pitchDeckUrl: safeUrl.optional().or(z.literal("")),
  demoUrl: safeUrl.optional().or(z.literal("")),
  githubUrl: safeUrl.optional().or(z.literal("")),
  fundingType: z.enum(["GRANT", "DEBT"]).optional(),
  fundingAmountKobo: z.number().int().nonnegative().optional(),
  minimumInvestmentKobo: z.number().int().nonnegative().optional(),
  fundingPurpose: z.string().trim().max(2000).optional().or(z.literal("")),
  submit: z.boolean().optional(),
});
