import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

/** The way into an online session: only for people allowed to join now. Never part of the event itself. */
export const GET = (_r: NextRequest, { params }: { params: { id: string } }) => api.publicJoin(params.id);
