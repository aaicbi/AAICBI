import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

export const GET = (_r: NextRequest, { params }: { params: { id: string } }) => api.publicDetail(params.id);
