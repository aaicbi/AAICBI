"use client";
import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import CertificateDisplay from "@/components/CertificateDisplay";

interface TemplateDto {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  reviewToken: string;
  approvedAt: string | null;
  customHtml: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

// Custom HTML Certificate Templates — the available {{token}} list,
// shown to whoever is pasting in a design so they know what's
// substitutable. Kept here, next to the form that produces the HTML,
// rather than only in code comments.
const AVAILABLE_TOKENS = [
  "{{traineeName}}", "{{verb}}", "{{credentialTitle}}", "{{issuedAt}}", "{{certificateCode}}",
  "{{organizationName}}", "{{logoUrl}}", "{{primaryColor}}", "{{accentColor}}",
  "{{signatoryName}}", "{{signatoryTitle}}", "{{qrCodeSvg}}",
];

/**
 * Training Organizations, Phase 1 — the SUPER_ADMIN-only certificate
 * design tool: create/edit a template (locked once the organization
 * approves it), upload its logo, and send it for review. The live
 * preview reuses CertificateCard — the exact same component the real
 * issued certificate and the public review page both render, so what
 * SUPER_ADMIN sees here is what actually ships, not an approximation.
 */
export default function CertificateTemplatesPage({ params }: { params: { id: string } }) {
  const [templates, setTemplates] = useState<TemplateDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#016B61");
  const [accentColor, setAccentColor] = useState("#D99A34");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryTitle, setSignatoryTitle] = useState("");
  const [customHtml, setCustomHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const selected = templates?.find((t) => t.id === selectedId) ?? null;

  function load() {
    fetch(`/api/admin/training-organizations/${params.id}/certificate-templates`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: TemplateDto[]) => {
        setTemplates(list);
        if (!selectedId && list.length > 0) selectTemplate(list[0]);
      })
      .catch(() => setTemplates([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(t: TemplateDto) {
    setSelectedId(t.id);
    setName(t.name);
    setPrimaryColor(t.primaryColor);
    setAccentColor(t.accentColor);
    setSignatoryName(t.signatoryName ?? "");
    setSignatoryTitle(t.signatoryTitle ?? "");
    setCustomHtml(t.customHtml ?? "");
  }

  function startNew() {
    setSelectedId(null);
    setName("");
    setPrimaryColor("#016B61");
    setAccentColor("#D99A34");
    setSignatoryName("");
    setSignatoryTitle("");
    setCustomHtml("");
  }

  function loadHtmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCustomHtml(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = { name, primaryColor, accentColor, signatoryName, signatoryTitle, customHtml };
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
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save. Try again.", "error");
      return;
    }
    const saved: TemplateDto = await res.json();
    setSelectedId(saved.id);
    showToast("Saved.");
    load();
  }

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

  const isLocked = !!selected?.approvedAt;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Certificate Templates</h1>
      <p className="mt-1 text-sm text-gray-500">Design a branded certificate, then send it to the organization for approval.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          {templates === null ? (
            <SkeletonList rows={2} />
          ) : (
            templates.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                      t.id === selectedId ? "border-brand-teal bg-brand-mint text-brand-teal" : "border-brand-gray text-gray-600"
                    }`}
                  >
                    {t.name} {t.approvedAt && <Badge variant="success">Approved</Badge>}
                  </button>
                ))}
                <button onClick={startNew} className="rounded-lg border border-dashed border-brand-gray px-3 py-1.5 text-sm font-semibold text-gray-500">
                  + New
                </button>
              </div>
            )
          )}

          <Card>
            {isLocked && <p className="mb-3 text-xs font-semibold text-brand-teal">This template is approved and locked.</p>}
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name, e.g. Default"
                disabled={isLocked}
                className="w-full rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal disabled:opacity-60"
              />
              <div className="flex gap-3">
                <label className="flex-1 text-xs font-semibold text-gray-600">
                  Primary color
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={isLocked}
                    className="mt-1 h-10 w-full rounded-lg border border-brand-gray disabled:opacity-60"
                  />
                </label>
                <label className="flex-1 text-xs font-semibold text-gray-600">
                  Accent color
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={isLocked}
                    className="mt-1 h-10 w-full rounded-lg border border-brand-gray disabled:opacity-60"
                  />
                </label>
              </div>

              {selected && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isLocked}
                    className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-60"
                  >
                    {uploading ? "Uploading..." : selected.logoUrl ? "Change logo" : "Upload logo"}
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <input
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="Signatory name (optional)"
                  disabled={isLocked}
                  className="flex-1 rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal disabled:opacity-60"
                />
                <input
                  value={signatoryTitle}
                  onChange={(e) => setSignatoryTitle(e.target.value)}
                  placeholder="Signatory title (optional)"
                  disabled={isLocked}
                  className="flex-1 rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal disabled:opacity-60"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600">Custom HTML (optional — overrides the design below)</label>
                  <div>
                    <input ref={htmlFileInputRef} type="file" accept=".html,text/html" onChange={loadHtmlFile} className="hidden" />
                    <button
                      onClick={() => htmlFileInputRef.current?.click()}
                      disabled={isLocked}
                      className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60"
                    >
                      Load from file
                    </button>
                  </div>
                </div>
                <textarea
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  placeholder="Paste or load a certificate's HTML. Leave blank to use the default design above."
                  disabled={isLocked}
                  rows={8}
                  className="w-full rounded-lg border border-brand-gray px-3 py-2.5 font-mono text-xs outline-none focus:border-brand-teal disabled:opacity-60"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Available tokens: {AVAILABLE_TOKENS.join(" ")}
                </p>
              </div>

              {!isLocked && (
                <Button onClick={save} loading={saving} disabled={!name.trim()}>
                  {selected ? "Save changes" : "Create template"}
                </Button>
              )}
              {selected && !isLocked && (
                <Button variant="secondary" onClick={sendForReview} loading={sending} className="ml-2">
                  Send for Review
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Live preview</p>
          <CertificateDisplay
            traineeName="Jane Doe"
            verb="has successfully completed"
            credentialTitle="Sample Course"
            issuedAt={new Date()}
            code="SAMPLE-0000-0000"
            branding={{
              organizationName: name || "Organization Name",
              logoUrl: selected?.logoUrl ?? null,
              primaryColor,
              accentColor,
              signatoryName,
              signatoryTitle,
            }}
            customHtml={customHtml || null}
          />
        </div>
      </div>
    </main>
  );
}
