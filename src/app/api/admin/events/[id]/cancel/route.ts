import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

export const POST = (req: NextRequest, { params }: { params: { id: string } }) => api.managerCancel(req, params.id);
