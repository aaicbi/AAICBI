"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PitchCohortOption {
  id: string;
  name: string;
}

interface PitchDetail {
  id: string;
  startupName: string;
  status: string;
  industry: string | null;
  problem: string | null;
  solution: string | null;
  targetMarket: string | null;
  businessModel: string | null;
  traction: string | null;
  teamDescription: string | null;
  pitchVideoUrl: string | null;
  pitchDeckUrl: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  fundingType: string | null;
  fundingAmountKobo: number | null;
  trainee: { name: string; email: string };
  cohort: { id: string; name: string } | null;
}

const REASON_CATEGORIES = [
  "Insufficient information",
  "Poor pitch clarity",
  "Project not sufficiently developed",
  "Missing documentation",
  "Business model concerns",
  "Does not meet AAICBI publishing criteria",
  "Other",
];

const RUBRIC_FIELDS = [
  { key: "technicalScore", label: "Technical Quality" },
  { key: "businessScore", label: "Business Clarity" },
  { key: "marketScore", label: "Market Understanding" },
  { key: "pitchQualityScore", label: "Pitch Quality" },
  { key: "documentationScore", label: "Documentation" },
] as const;

export default function AdminPitchReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pitch, setPitch] = useState<PitchDetail | null>(null);
  const [cohorts, setCohorts] = useState<PitchCohortOption[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [cohortId, setCohortId] = useState("");
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/pitches/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => {
        setPitch(p);
        setCohortId(p.cohort?.id ?? "");
      })
      .catch(() => setPitch(null));
    fetch("/api/admin/pitch-cohorts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCohorts)
      .catch(() => setCohorts([]));
  }, [params.id]);

  async function decide(decision: "APPROVE" | "NEEDS_REVISION" | "REJECT") {
    if (decision !== "APPROVE" && !note.trim()) {
      showToast("A note is required for this decision.", "error");
      return;
    }
    setBusy(decision);
    const res = await fetch(`/api/admin/pitches/${params.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        reasonCategory: decision !== "APPROVE" ? reasonCategory : undefined,
        note: decision !== "APPROVE" ? note : undefined,
        cohortId: decision === "APPROVE" ? cohortId || undefined : undefined,
        ...scores,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't complete that decision.", "error");
      return;
    }
    showToast("Decision recorded.", "success");
    router.push("/admin/pitches");
  }

  if (!pitch) {
    return (
      <>
        <SiteHeader nav={[{ label: "Pitches", href: "/admin/pitches" }]} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <SkeletonList rows={3} />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Pitches", href: "/admin/pitches" },
          { label: "Pitch Cohorts", href: "/admin/pitch-cohorts" },
          { label: "Investors", href: "/admin/investors" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{pitch.startupName}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {pitch.trainee.name} · {pitch.trainee.email}
            </p>
          </div>
          <Badge variant="warning">{pitch.status}</Badge>
        </div>

        <Card className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {pitch.pitchVideoUrl && (
              <a href={pitch.pitchVideoUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">
                ▶ Watch Pitch
              </a>
            )}
            {pitch.pitchDeckUrl && (
              <a href={pitch.pitchDeckUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">
                Open Deck
              </a>
            )}
            {pitch.demoUrl && (
              <a href={pitch.demoUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">
                Open Demo
              </a>
            )}
            {pitch.githubUrl && (
              <a href={pitch.githubUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">
                Open Repository
              </a>
            )}
          </div>

          <div className="rounded-lg bg-brand-sand p-4 text-sm leading-relaxed">
            {pitch.problem && (
              <p>
                <b>Problem</b> — {pitch.problem}
              </p>
            )}
            {pitch.solution && (
              <p>
                <b>Solution</b> — {pitch.solution}
              </p>
            )}
            {pitch.traction && (
              <p>
                <b>Traction</b> — {pitch.traction}
              </p>
            )}
            {pitch.businessModel && (
              <p>
                <b>Business Model</b> — {pitch.businessModel}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-brand-mint p-3">
            <span className="text-sm font-semibold">Funding requested</span>
            <span className="font-display font-semibold text-brand-tealDeep">
              {pitch.fundingAmountKobo != null ? `₦${(pitch.fundingAmountKobo / 100).toLocaleString()}` : "—"} {pitch.fundingType ? `· ${pitch.fundingType}` : ""}
            </span>
          </div>
        </Card>

        <Card className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin Review</p>
          <div className="mt-3 space-y-2">
            {RUBRIC_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between text-sm">
                <span>{f.label}</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={scores[f.key] ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
                  className="w-16 rounded-lg border border-brand-gray px-2 py-1 text-center text-sm outline-none focus:border-brand-teal"
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-500">Assign to cohort (for Approve)</label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            >
              <option value="">No cohort yet</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-500">Reason category (for Request Revision / Reject)</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            >
              {REASON_CATEGORIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Note to the founder"
              className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => decide("APPROVE")} loading={busy === "APPROVE"}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => decide("NEEDS_REVISION")} loading={busy === "NEEDS_REVISION"}>
              Request Revision
            </Button>
            <Button variant="danger" onClick={() => decide("REJECT")} loading={busy === "REJECT"}>
              Reject
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">Request Revision or Reject requires a reason category and a note before it can be sent.</p>
        </Card>
      </main>
    </>
  );
}
