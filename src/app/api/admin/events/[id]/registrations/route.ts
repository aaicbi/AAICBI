import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };
export const GET = (_r: NextRequest, { params }: Ctx) => api.managerRegistrations(params.id);
export const POST = (req: NextRequest, { params }: Ctx) => api.managerRegistrationAction(req, params.id);
