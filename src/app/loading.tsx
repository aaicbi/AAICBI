import RouteLoading from "@/components/ui/RouteLoading";

/** Shown at once while any page without its own loading screen is being prepared, so a slow server or network never leaves a blank page. */
export default function Loading() {
  return <RouteLoading />;
}
