"use client";
import RouteError from "@/components/ui/RouteError";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} homeHref="/employer/dashboard" homeLabel="Back to dashboard" />;
}
