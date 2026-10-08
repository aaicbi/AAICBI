"use client";
import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { SkeletonList } from "@/components/ui/Skeleton";
import CertificateDisplay from "@/components/CertificateDisplay";
import Modal from "@/components/ui/Modal";
import PayCertWatermarkFeeButton from "@/components/org/PayCertWatermarkFeeButton";
import CertificateCanvasEditor from "@/components/certificateEditor/CertificateCanvasEditor";
import { CERTIFICATE_PRESETS } from "@/lib/certificatePresets";
import type { CertificateLayout } from "@/lib/certificateLayout";

import { Input } from "@/components/ui/Field";
interface TemplateDto {
  id: string;
  name: string;
  logoUrl: string | null;
  reviewToken: string;
  approvedAt: string | null;
  layoutJson: CertificateLayout | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

/**
 * Training Organizations, Phase 1 — the certificate design tool: create/
 * edit a template (locked once the organization approves it), upload
 * its logo, and send it for review. Originally SUPER_ADMIN-only; now
 * also reachable by the organization's own ADMIN session for this exact
 * org (see requireTrainingOrgAccess, src/lib/trainingOrgStaff.ts) —
 * either way, every template still needs SUPER_ADMIN to send it for
 * review and the organization to approve it before it's used on real
 * certificates (unchanged). This page itself has no SUPER_ADMIN-
 * specific UI; it's fully generic on `params.id`, so the org-facing
 * /admin/certificate-templates redirect wrapper reuses it unchanged.
 *
 * Visual Certificate Design Editor — the one engine every certificate
 * now goes through: the Fabric.js canvas is the only way a design
 * exists, seeded from a presets gallery instead of a blank page, with
 * the live preview below reusing CertificateDisplay — the exact same
 * component the real issued certificate and the public review page
 * both render, so what's seen here is what actually ships — including
 * the "Powered by AAICBI" watermark, see showWatermark below.
 */
export default function CertificateTemplatesPage({ params }: { params: { id: string } }) {
  const [templates, setTemplates] = useState<TemplateDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryTitle, setSignatoryTitle] = useState("");
  const [layoutJson, setLayoutJson] = useState<CertificateLayout | null>(null);
  // CertificateCanvasEditor only loads its `layout` prop once, at mount
  // (so mid-edit prop churn can't stomp on in-progress canvas state) —
  // it re-initializes only when its `key` changes. Picking a gallery
  // preset doesn't change `selectedId` (a brand-new template has none,
  // and "Start from a different template" deliberately keeps editing
  // the same template), so this counter is what actually forces the
  // remount that loads the newly-picked design onto the canvas.
  const [designVersion, setDesignVersion] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Certificate watermark removal — this org's current "Powered by
  // AAICBI" status, computed server-side by the list GET route (see
  // that route's own comment) so the gallery thumbnails/Preview modal
  // below show exactly what this org's real certificates would get.
  // viewerRole drives the "go premium" banner, shown only to the org's
  // own ADMIN, never to SUPER_ADMIN (who isn't the one who'd pay).
  const [showWatermark, setShowWatermark] = useState(true);
  const [viewerRole, setViewerRole] = useState<"SUPER_ADMIN" | "ADMIN" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Loading a template (or starting a new one) sets name/signatoryName/
  // signatoryTitle/layoutJson programmatically — the same state an actual
  // edit touches — so the autosave effect below needs a way to tell "just
  // switched templates" apart from "the admin changed something." A
  // snapshot of the just-loaded (unedited) values, compared against the
  // live state on every effect run: a plain "skip the next effect run"
  // flag doesn't work here, because React can batch the template-load's
  // state updates together with an immediate follow-up edit (e.g. picking
  // a preset right after selecting a template with no design yet — a very
  // natural, fast sequence, since that auto-opens the gallery) into ONE
  // combined render, which would silently skip that first real edit too.
  // A baseline diff is immune to how renders get batched: it just asks
  // "does the current state differ from what was loaded," however many
  // renders it took to get here.
  // merely opening a template would immediately queue a pointless autosave.
  const autosaveBaselineRef = useRef<string>(JSON.stringify({ name: "", signatoryName: "", signatoryTitle: "", layoutJson: null }));
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();

  const selected = templates?.find((t) => t.id === selectedId) ?? null;
  const isLocked = !!selected?.approvedAt;

  function load() {
    fetch(`/api/admin/training-organizations/${params.id}/certificate-templates`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { templates: TemplateDto[]; showWatermark: boolean; viewerRole: "SUPER_ADMIN" | "ADMIN" }) => {
        setTemplates(body.templates);
        setShowWatermark(body.showWatermark);
        setViewerRole(body.viewerRole);
        if (!selectedId && body.templates.length > 0) selectTemplate(body.templates[0]);
      })
      .catch(() => setTemplates([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(t: TemplateDto) {
    autosaveBaselineRef.current = JSON.stringify({ name: t.name, signatoryName: t.signatoryName ?? "", signatoryTitle: t.signatoryTitle ?? "", layoutJson: t.layoutJson ?? null });
    setAutosaveStatus("idle");
    setSelectedId(t.id);
    setName(t.name);
    setSignatoryName(t.signatoryName ?? "");
    setSignatoryTitle(t.signatoryTitle ?? "");
    setLayoutJson(t.layoutJson ?? null);
    setDesignVersion(0);
    // A template with nothing designed yet goes straight to the
    // gallery rather than leaving an empty canvas with no obvious next
    // step — the gallery trigger alone was easy to miss.
    setGalleryOpen(!t.layoutJson && !t.approvedAt);
  }

  function startNew() {
    autosaveBaselineRef.current = JSON.stringify({ name: "", signatoryName: "", signatoryTitle: "", layoutJson: null });
    setAutosaveStatus("idle");
    setSelectedId(null);
    setName("");
    setSignatoryName("");
    setSignatoryTitle("");
    setLayoutJson(null);
    setDesignVersion(0);
    setGalleryOpen(true);
  }

  function pickPreset(layout: CertificateLayout | null) {
    setLayoutJson(layout);
    setDesignVersion((v) => v + 1);
    setGalleryOpen(false);
  }

  async function save(opts?: { silent?: boolean }) {
    if (!name.trim()) return;
    // Autosave and a manual "Save changes" click can otherwise race (e.g.
    // the debounce timer fires the instant after the admin clicks Save) —
    // whichever got here first wins, the other is just skipped rather than
    // sending a duplicate PATCH/POST.
    if (savingRef.current) return;
    savingRef.current = true;
    if (opts?.silent) setAutosaveStatus("saving");
    else setSaving(true);
    const payload = { name, primaryColor: "#016B61", accentColor: "#D99A34", signatoryName, signatoryTitle, layoutJson };
    const res = selected
      ? await fetch(`/api/admin/certificate-templates/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/admin/training-organizations/${params.id}/certificate-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    savingRef.current = false;
    if (!opts?.silent) setSaving(false);
    if (!res.ok) {
      if (opts?.silent) {
        setAutosaveStatus("error");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(typeof data.error === "string" ? data.error : "Could not save. Try again.", "error");
      }
      return;
    }
    const saved: TemplateDto = await res.json();
    setSelectedId(saved.id);
    // Whatever was just sent is now the clean baseline — otherwise the
    // next autosave-effect run would still see a "diff" against the OLD
    // pre-save baseline and immediately queue a redundant autosave for
    // content that's already saved.
    autosaveBaselineRef.current = JSON.stringify({ name, signatoryName, signatoryTitle, layoutJson });
    if (opts?.silent) setAutosaveStatus("saved");
    else {
      setAutosaveStatus("idle");
      showToast("Saved.");
    }
    load();
  }

  // Debounced autosave — fires ~2s after the admin stops editing the name,
  // signatory fields, or the canvas design, so work survives a crash or an
  // accidental navigation without waiting on an explicit "Save changes"
  // click. Silent (no toast) — the small status line next to the Save
  // button is the only feedback, so steady background saves during active
  // editing don't turn into a stream of toasts.
  useEffect(() => {
    if (isLocked) return;
    const snapshot = JSON.stringify({ name, signatoryName, signatoryTitle, layoutJson });
    if (snapshot === autosaveBaselineRef.current) return; // nothing has actually changed since the last load/save
    if (!name.trim()) return; // nothing to identify the draft by yet
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      save({ silent: true });
    }, 2000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, signatoryName, signatoryTitle, layoutJson, isLocked]);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const res = await fetch(`/api/admin/certificate-templates/${selected.id}/logo`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not upload. Try again.", "error");
      return;
    }
    showToast("Logo updated.");
    load();
  }

  async function sendForReview() {
    if (!selected) return;
    setSending(true);
    const res = await fetch(`/api/admin/certificate-templates/${selected.id}/send-review`, { method: "POST" });
    setSending(false);
    if (!res.ok) {
      showToast("Could not send for review. Try again.", "error");
      return;
    }
    showToast("Sent for review.");
  }

  async function deleteTemplate(t: TemplateDto) {
    const ok = await confirm({
      title: `Delete "${t.name}"?`,
      description: "This can't be undone. Only unapproved templates can be deleted.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/certificate-templates/${t.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not delete. Try again.", "error");
      return;
    }
    showToast("Deleted.");
    if (selectedId === t.id) startNew();
    load();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {modal}
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Certificate Templates</h1>
      <p className="mt-1 text-sm text-gray-500">Design a branded certificate, then send it to the organization for approval.</p>

      {templates === null ? (
        <SkeletonList rows={2} />
      ) : (
        templates.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {templates.map((t) => (
              <div key={t.id} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${t.id === selectedId ? "border-brand-teal bg-brand-mint" : "border-brand-gray"}`}>
                <button onClick={() => selectTemplate(t)} className={`text-sm font-semibold ${t.id === selectedId ? "text-brand-teal" : "text-gray-600"}`}>
                  {t.name} {t.approvedAt && <Badge variant="success">Approved</Badge>}
                </button>
                {!t.approvedAt && (
                  <button onClick={() => deleteTemplate(t)} disabled={deleting} className="text-xs font-semibold text-brand-rose hover:underline" title="Delete this template">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button onClick={startNew} className="rounded-lg border border-dashed border-brand-gray px-3 py-1.5 text-sm font-semibold text-gray-500">
              + New
            </button>
          </div>
        )
      )}

      <Card className="mt-4">
        {isLocked && <p className="mb-3 text-xs font-semibold text-brand-teal">This template is approved and locked.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Template name, e.g. Default" hideLabel wrapperClassName="flex-1" controlClassName="disabled:opacity-60" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name, e.g. Default" disabled={isLocked} />
          <Input label="Signatory name (optional)" hideLabel wrapperClassName="flex-1" controlClassName="disabled:opacity-60" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Signatory name (optional)" disabled={isLocked} />
          <Input label="Signatory title (optional)" hideLabel wrapperClassName="flex-1" controlClassName="disabled:opacity-60" value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} placeholder="Signatory title (optional)" disabled={isLocked} />
          {selected && (
            <div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isLocked}
                className="rounded-lg border border-brand-gray px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-60"
              >
                {uploading ? "Uploading..." : selected.logoUrl ? "Change logo" : "Upload logo"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isLocked && (
            <Button onClick={() => save()} loading={saving} disabled={!name.trim()}>
              {selected ? "Save changes" : "Create template"}
            </Button>
          )}
          {selected && !isLocked && (
            <Button variant="secondary" onClick={sendForReview} loading={sending}>
              Send for Review
            </Button>
          )}
          {!isLocked && (
            <button onClick={() => setGalleryOpen(true)} className="rounded-lg border border-brand-gray px-3 py-2 text-xs font-semibold text-brand-ink">
              {layoutJson ? "Start from a different template" : "Choose a starting template"}
            </button>
          )}
          {layoutJson && (
            <button onClick={() => setPreviewOpen(true)} className="rounded-lg border border-brand-teal px-3 py-2 text-xs font-semibold text-brand-teal">
              Preview
            </button>
          )}
          {!isLocked && !saving && autosaveStatus !== "idle" && (
            <span className="text-xs text-gray-400">
              {autosaveStatus === "saving" && "Saving draft…"}
              {autosaveStatus === "saved" && "Draft saved"}
              {autosaveStatus === "error" && "Could not autosave — try Save changes"}
            </span>
          )}
        </div>
      </Card>

      {galleryOpen && !isLocked && (
        <Card className="mt-4">
          <p className="mb-3 text-sm font-semibold text-brand-ink">Choose a starting template</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CERTIFICATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => pickPreset(preset.layout)}
                className="overflow-hidden rounded-lg border border-brand-gray text-left hover:border-brand-teal"
              >
                <div className="w-full" style={{ maxWidth: 220 }}>
                  <CertificateDisplay
                    traineeName="Jane Doe"
                    verb="has successfully completed"
                    credentialTitle="Sample Course"
                    issuedAt={new Date()}
                    code="SAMPLE-0000-0000"
                    branding={{ organizationName: name || "Organization Name", logoUrl: selected?.logoUrl ?? null }}
                    layoutJson={preset.layout}
                    showWatermark={showWatermark}
                  />
                </div>
                <p className="border-t border-brand-gray px-2 py-1.5 text-xs font-semibold text-gray-700">{preset.name}</p>
              </button>
            ))}
            <button onClick={() => pickPreset(null)} className="flex flex-col items-center justify-center rounded-lg border border-dashed border-brand-gray p-4 text-xs font-semibold text-gray-500 hover:border-brand-teal">
              Blank canvas
            </button>
          </div>
        </Card>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Design</p>
        <Card>
          <CertificateCanvasEditor
            key={`${selectedId ?? "new"}-${designVersion}`}
            layout={layoutJson}
            onChange={setLayoutJson}
            logoUrl={selected?.logoUrl ?? null}
            disabled={isLocked}
            backgroundUploadUrl={`/api/admin/training-organizations/${params.id}/certificate-backgrounds`}
          />
          <p className="mt-3 text-xs text-gray-500">
            A &quot;Powered by AAICBI&quot; watermark is added automatically to every certificate and can&apos;t be removed from this editor.
          </p>
          {showWatermark && viewerRole === "ADMIN" && (
            <div className="mt-3">
              <PayCertWatermarkFeeButton label="Remove watermark" />
            </div>
          )}
        </Card>
      </div>

      <Modal open={previewOpen && !!layoutJson} onClose={() => setPreviewOpen(false)} title="Preview: exactly what's on the canvas" size="lg">
        <div className="mt-4">
          {layoutJson && (
            <CertificateDisplay
              traineeName="Jane Doe"
              verb="has successfully completed"
              credentialTitle="Sample Course"
              issuedAt={new Date()}
              code="SAMPLE-0000-0000"
              branding={{
                organizationName: name || "Organization Name",
                logoUrl: selected?.logoUrl ?? null,
                signatoryName,
                signatoryTitle,
              }}
              layoutJson={layoutJson}
              showWatermark={showWatermark}
            />
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </main>
  );
}
