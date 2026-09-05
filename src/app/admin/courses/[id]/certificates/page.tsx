"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";

interface CertificateRow {
  id: string;
  code: string;
  issuedAt: string;
  revokedAt: string | null;
  trainee: { name: string; email: string };
}

/**
 * M15 — the admin-facing twin of the trainee's own certificate view:
 * every certificate issued for a course, in one list, so staff can
 * answer "who has completed this course" without digging through the
 * database. Same "give both trainees and admins visibility" pattern
 * this project has followed since M13's performance summaries.
 *
 * Design-pass update: native confirm() replaced with ConfirmModal (this
 * revoke action needed to actually explain its consequence, which the
 * browser dialog couldn't), and the empty state now uses the
 * achievement doodle — the one place besides the certificate page
 * itself where "no certificates yet" and "certificates" belong in the
 * same visual language.
 */
export default function CourseCertificatesPage({ params }: { params: { id: string } }) {
  const [certificates, setCertificates] = useState<CertificateRow[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  useEffect(() => {
    loadCertificates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function loadCertificates() {
    fetch(`/api/courses/${params.id}/certificates`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setCertificates(data.certificates);
      })
      .catch(() => setNotFound(true));
  }

  async function toggleRevoked(certificateId: string, currentlyRevoked: boolean) {
    const ok = await confirm(
      currentlyRevoked
        ? {
            title: "Restore this certificate?",
            description: "It will show as valid again on its public verification page immediately.",
            confirmLabel: "Restore",
          }
        : {
            title: "Revoke this certificate?",
            description: "Its public verification page will show it as revoked immediately.",
            confirmLabel: "Revoke",
            danger: true,
          }
    );
    if (!ok) return;

    setBusyId(certificateId);
    const res = await fetch(`/api/certificates/${certificateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revoked: !currentlyRevoked }),
    });
    setBusyId(null);
    if (res.ok) {
      showToast(currentlyRevoked ? "Certificate restored." : "Certificate revoked.", "success");
    } else {
      showToast("Something went wrong. Please try again.", "error");
    }
    loadCertificates();
  }

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          Course not found, or you don&apos;t have access to it.
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <a href={`/admin/courses/${params.id}`} className="text-sm text-brand-teal hover:underline">
          ← Back to course
        </a>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Certificates Issued</h1>

        {certificates !== null && certificates.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              illustration={<AchievementDoodle className="h-full w-full" />}
              title="No certificates issued yet"
              description="Certificates are issued automatically the moment a trainee completes every module in this course — nothing to configure."
            />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-gray text-gray-500">
                <th className="py-2">Trainee</th>
                <th>Code</th>
                <th>Issued</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {certificates === null ? (
                <SkeletonTableRows rows={4} cols={5} />
              ) : (
                certificates.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <div className="font-medium text-brand-ink">{c.trainee.name}</div>
                      <div className="text-xs text-gray-500">{c.trainee.email}</div>
                    </td>
                    <td className="font-mono text-xs">{c.code}</td>
                    <td className="text-xs text-gray-500">{new Date(c.issuedAt).toLocaleDateString()}</td>
                    <td>
                      <Badge variant={c.revokedAt ? "danger" : "success"}>{c.revokedAt ? "Revoked" : "Valid"}</Badge>
                    </td>
                    <td>
                      <a
                        href={`/certificate/${c.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-teal hover:underline"
                      >
                        View →
                      </a>
                      <button
                        onClick={() => toggleRevoked(c.id, !!c.revokedAt)}
                        disabled={busyId === c.id}
                        className={`ml-3 text-xs font-semibold hover:underline ${
                          c.revokedAt ? "text-brand-teal" : "text-brand-rose"
                        }`}
                      >
                        {busyId === c.id ? "…" : c.revokedAt ? "Restore" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
