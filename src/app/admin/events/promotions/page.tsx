import { redirect } from "next/navigation";

/** The link inside "a promotion request arrived" notifications. */
export default function PromotionsRedirect() { redirect("/admin/events?section=promotions"); }
