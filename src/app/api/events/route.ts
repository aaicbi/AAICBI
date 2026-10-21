import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

/** Events the signed-in person (or a visitor) may see. */
export const GET = (req: NextRequest) => api.publicList(req);
