import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => api.platformSettings(req);
export const POST = (req: NextRequest) => api.platformSettings(req);
