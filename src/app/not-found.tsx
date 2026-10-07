import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

export const metadata = { title: "Page not found" };

/** Shown for any unknown URL, in place of the framework's default 404. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-16">
        <EmptyState
          illustration={<GrowthPathDoodle className="h-full w-full" />}
          title="We couldn't find that page"
          description="The link may be out of date or mistyped. Check the address, or head back to somewhere that works."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button href="/">Go to the home page</Button>
              <Button href="/certificate" variant="secondary">
                Verify a certificate
              </Button>
            </div>
          }
        />
      </main>
    </>
  );
}
