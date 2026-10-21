import { NextRequest } from "next/server";
import * as api from "@/lib/events/eventsApi";

export const dynamic = "force-dynamic";

export const GET = () => api.platformCategories();
export const POST = (req: NextRequest) => api.platformCategorySave(req);
