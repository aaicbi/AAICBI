import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };
export const POST = (req: NextRequest, { params }: Ctx) => api.publicRegister(req, params.id);
export const DELETE = (_r: NextRequest, { params }: Ctx) => api.publicUnregister(params.id);
