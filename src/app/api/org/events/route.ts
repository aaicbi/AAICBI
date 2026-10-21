import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

/** Organization Event Manager. Who is acting decides what is allowed (see src/lib/events/eventsApi.ts); every action is checked again on the server. */
export const GET = (req: NextRequest) => api.managerList(req);
export const POST = (req: NextRequest) => api.managerCreate(req);
