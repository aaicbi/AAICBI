import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

/** Organization Event Manager. Who is acting decides what is allowed (see src/lib/events/eventsApi.ts); every action is checked again on the server. */
type Ctx = { params: { id: string } };
export const GET = (_r: NextRequest, { params }: Ctx) => api.managerDetail(params.id);
export const PUT = (req: NextRequest, { params }: Ctx) => api.managerUpdate(req, params.id);
export const DELETE = (_r: NextRequest, { params }: Ctx) => api.managerDelete(params.id);
