"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface Integration {
  id: string;
  label: string;
  description: string;
  status: "connected" | "not_configured" | "coming_soon";
}

const STATUS_LABEL: Record<Integration["status"], string> = {
  connected: "Connected",
  not_configured: "Not configured",
  coming_soon: "Coming soon",
};
const STATUS_VARIANT: Record<Integration["status"], "success" | "warning" | "neutral"> = {
  connected: "success",
  not_configured: "warning",
  coming_soon: "neutral",
};

/**
 * Settings-page redesign, Integrations category — entirely read-only,
 * on purpose (see the API route's own comment: these are all set via
 * real deployment environment variables, never through a web form).
 * The real value here is diagnostic, not configuration: this exact
 * gap ("why isn't email/payment/upload working?") has come up
 * repeatedly as a genuinely confusing, silent failure elsewhere in
 * this app — this page gives an admin one place to see the actual
 * cause at a glance instead of guessing from a vague error message.
 */
export default function IntegrationsPanel({ viewerRole }: { viewerRole?: string }) {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    setForbidden(false);
    setIntegrations(null);
    fetch("/api/admin/integrations-status")
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((json: { integrations: Integration[] } | null) => {
        if (!json) return;
        setIntegrations(json.integrations);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (viewerRole && viewerRole !== "SUPER_ADMIN") {
      setForbidden(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRole]);

  if (forbidden) {
    return (
      <Card>
        <p className="font-display font-semibold text-brand-ink">Integrations</p>
        <p className="mt-2 text-sm text-gray-600">
          Only Super Admins can view integration status. If you need something changed here, ask a Super Admin on
          your team.
        </p>
      </Card>
    );
  }

  if (loadError) {
    return <ErrorState message="We couldn't load integration status." onRetry={load} />;
  }

  if (integrations === null) {
    return <SkeletonList rows={4} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        These are configured through environment variables at deployment, not here — this is a status view, not a
        form. See DEPLOYMENT.md for how to set each one up.
      </p>
      {integrations.map((i) => (
        <Card key={i.id} className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-brand-ink">{i.label}</p>
            <p className="mt-1 text-sm text-gray-600">{i.description}</p>
          </div>
          <Badge variant={STATUS_VARIANT[i.status]}>{STATUS_LABEL[i.status]}</Badge>
        </Card>
      ))}
    </div>
  );
}
