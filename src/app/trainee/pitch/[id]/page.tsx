"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PitchDetail {
  id: string;
  startupName: string;
  status: "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "APPROVED" | "REJECTED" | "PUBLISHED";
  industry: string | null;
  problem: string | null;
  solution: string | null;
  targetMarket: string | null;
  businessModel: string | null;
  stage: string | null;
  traction: string | null;
  teamDescription: string | null;
  pitchVideoUrl: string | null;
  pitchDeckUrl: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  fundingType: "GRANT" | "DEBT" | null;
  fundingAmountKobo: number | null;
  minimumInvestmentKobo: number | null;
  fundingPurpose: string | null;
  rejectionReasonCategory: string | null;
  rejectionNote: string | null;
}

interface DisclosureRow {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  requestMessage: string | null;
  investor: { name: string; organization: string };
}

const STATUS_LABEL: Record<PitchDetail["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Under Review",
  NEEDS_REVISION: "Needs Revision",
  APPROVED: "Approved",
  REJECTED: "Not Approved",
  PUBLISHED: "Published",
};

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Pitch & Post", href: "/trainee/pitch" },
  { label: "Messages", href: "/trainee/messages" },
];

function naira(kobo: number | null) {
  if (kobo == null) return null;
  return `₦${(kobo / 100).toLocaleString()}`;
}

export default function PitchDetailPage({ params }: { params: { id: string } }) {
  const { showToast } = useToast();
  const [pitch, setPitch] = useState<PitchDetail | null>(null);
  const [disclosures, setDisclosures] = useState<DisclosureRow[] | null>(null);
  const [checklist, setChecklist] = useState<Record<string, { video: boolean; deck: boolean; demo: boolean; github: boolean }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch(`/api/trainee/pitches/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPitch)
      .catch(() => setPitch(null));
    fetch(`/api/trainee/pitches/${params.id}/disclosures`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDisclosures)
      .catch(() => setDisclosures([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function respond(discId: string, action: "ACCEPT" | "DECLINE") {
    setBusyId(discId);
    const c = checklist[discId] ?? { video: false, deck: false, demo: false, github: false };
    const res = await fetch(`/api/trainee/pitches/${params.id}/disclosures/${discId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        shareVideo: c.video,
        shareDeck: c.deck,
        shareDemo: c.demo,
        shareGithub: c.github,
      }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not send your response.", "error");
      return;
    }
    showToast(action === "ACCEPT" ? "Shared with this investor." : "Declined.", "success");
    load();
  }

  if (pitch === null) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <SkeletonList rows={3} />
        </main>
      </>
    );
  }

  const pending = (disclosures ?? []).filter((d) => d.status === "PENDING");
  const decided = (disclosures ?? []).filter((d) => d.status !== "PENDING");

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">{pitch.startupName}</h1>
          <Badge variant={pitch.status === "PUBLISHED" ? "gold" : pitch.status === "APPROVED" ? "success" : pitch.status === "REJECTED" ? "danger" : "warning"}>
            {STATUS_LABEL[pitch.status]}
          </Badge>
        </div>

        {pitch.status === "NEEDS_REVISION" && (
          <Card className="mt-4 border-brand-gold bg-brand-goldLight/40">
            <p className="text-sm font-semibold text-brand-goldText">This pitch needs a revision.</p>
            {pitch.rejectionNote && <p className="mt-1 text-sm text-gray-700">{pitch.rejectionNote}</p>}
            <div className="mt-3 flex gap-2">
              <Button size="sm" href="/trainee/messages">
                View Feedback Thread
              </Button>
              <Button size="sm" variant="secondary" href={`/trainee/pitch/${pitch.id}/edit`}>
                Edit &amp; Resubmit
              </Button>
            </div>
          </Card>
        )}

        {pitch.status === "REJECTED" && pitch.rejectionNote && (
          <Card className="mt-4 border-brand-rose bg-brand-roseLight/40">
            <p className="text-sm font-semibold text-brand-rose">Not approved for publication at this time.</p>
            <p className="mt-1 text-sm text-gray-700">{pitch.rejectionNote}</p>
          </Card>
        )}

        {pitch.status === "DRAFT" && (
          <Card className="mt-4">
            <p className="text-sm text-gray-600">This pitch is still a draft.</p>
            <Button size="sm" className="mt-2" href={`/trainee/pitch/${pitch.id}/edit`}>
              Continue Editing
            </Button>
          </Card>
        )}

        <Card className="mt-4 space-y-2 text-sm text-gray-700">
          {pitch.industry && <p><span className="font-semibold text-brand-ink">Industry:</span> {pitch.industry}</p>}
          {pitch.stage && <p><span className="font-semibold text-brand-ink">Stage:</span> {pitch.stage}</p>}
          {pitch.problem && <p><span className="font-semibold text-brand-ink">Problem:</span> {pitch.problem}</p>}
          {pitch.solution && <p><span className="font-semibold text-brand-ink">Solution:</span> {pitch.solution}</p>}
          {pitch.fundingAmountKobo != null && (
            <p><span className="font-semibold text-brand-ink">Funding requested:</span> {naira(pitch.fundingAmountKobo)} {pitch.fundingType ? `· ${pitch.fundingType}` : ""}</p>
          )}
        </Card>

        {(pending.length > 0 || decided.length > 0) && (
          <>
            <h2 className="mt-8 text-sm font-semibold text-gray-500">Disclosure Requests</h2>
            <div className="mt-2 space-y-3">
              {pending.map((d) => {
                const c = checklist[d.id] ?? { video: false, deck: false, demo: false, github: false };
                return (
                  <Card key={d.id}>
                    <p className="text-sm font-semibold text-brand-ink">
                      {d.investor.name} <span className="font-normal text-gray-500">· {d.investor.organization}</span>
                    </p>
                    {d.requestMessage && <p className="mt-1 text-sm italic text-gray-600">&quot;{d.requestMessage}&quot;</p>}
                    <div className="mt-3 rounded-lg bg-brand-sand p-3">
                      <p className="text-xs font-semibold text-gray-500">Choose what to share if you accept</p>
                      <div className="mt-2 space-y-1 text-sm">
                        {(["video", "deck", "demo", "github"] as const).map((key) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={c[key]}
                              onChange={(e) => setChecklist((prev) => ({ ...prev, [d.id]: { ...c, [key]: e.target.checked } }))}
                              className="h-3.5 w-3.5 rounded border-brand-gray text-brand-teal focus:ring-brand-teal"
                            />
                            {key === "video" ? "Pitch Video" : key === "deck" ? "Pitch Deck" : key === "demo" ? "Demo" : "GitHub Repository"}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => respond(d.id, "ACCEPT")} loading={busyId === d.id}>
                        Confirm &amp; Share
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => respond(d.id, "DECLINE")} loading={busyId === d.id}>
                        Decline
                      </Button>
                    </div>
                  </Card>
                );
              })}
              {decided.map((d) => (
                <Card key={d.id} className="flex items-center justify-between opacity-70">
                  <p className="text-sm">
                    <span className="font-semibold">{d.investor.name}</span> · {d.investor.organization}
                  </p>
                  <Badge variant={d.status === "ACCEPTED" ? "success" : "danger"}>{d.status === "ACCEPTED" ? "Shared" : "Declined"}</Badge>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
