"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_INSTRUCTOR_AGREEMENT_NAME, DEFAULT_INSTRUCTOR_AGREEMENT_CONTENT } from "@/lib/instructorAgreementTemplate";

interface TemplateDto {
  id: string;
  name: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

/**
 * /admin/agreement-templates — CRUD for the merge-field templates
 * POST /api/admin/instructors/[id]/agreement resolves at send time.
 * "Use AAICBI Standard Letter of Engagement" seeds the real, full-text
 * Letter of Engagement (see instructorAgreementTemplate.ts) as a
 * one-click starting point rather than asking an admin to type 24
 * sections of legal text from scratch — it's then an ordinary editable
 * template like any other.
 */
export default function AgreementTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateDto[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<TemplateDto | "new" | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function load() {
    setError(false);
    fetch("/api/admin/agreement-templates")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setTemplates)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew(prefill?: { name: string; content: string }) {
    setEditing("new");
    setName(prefill?.name ?? "");
    setContent(prefill?.content ?? "");
  }

  function openEdit(t: TemplateDto) {
    setEditing(t);
    setName(t.name);
    setContent(t.content);
  }

  async function save() {
    setSaving(true);
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/admin/agreement-templates" : `/api/admin/agreement-templates/${(editing as TemplateDto).id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save template.", "error");
      return;
    }
    showToast(isNew ? "Template created." : "Template updated.");
    setEditing(null);
    load();
  }

  async function toggleActive(t: TemplateDto) {
    await fetch(`/api/admin/agreement-templates/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    load();
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Instructors", href: "/admin/instructors" },
          { label: "Agreement Templates", href: "/admin/agreement-templates" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Agreement Templates</h1>
            <p className="mt-1 text-sm text-gray-500">Merge-field templates used when sending an instructor their agreement.</p>
          </div>
          {!editing && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => openNew({ name: DEFAULT_INSTRUCTOR_AGREEMENT_NAME, content: DEFAULT_INSTRUCTOR_AGREEMENT_CONTENT })}
              >
                Use AAICBI Standard Letter
              </Button>
              <Button onClick={() => openNew()}>+ New Template</Button>
            </div>
          )}
        </div>

        {editing && (
          <Card className="mt-4">
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                placeholder="Agreement content — use {{INSTRUCTOR_NAME}}, {{COURSE_NAME}}, {{REMUNERATION_AMOUNT}}, etc."
                className="w-full rounded-lg border border-brand-gray px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-brand-teal"
              />
              <p className="text-xs text-gray-500">
                Available tokens: {"{{LETTER_DATE}}"}, {"{{INSTRUCTOR_NAME}}"}, {"{{INSTRUCTOR_EMAIL}}"}, {"{{INSTRUCTOR_ADDRESS}}"},{" "}
                {"{{INSTRUCTOR_PHONE}}"}, {"{{POSITION}}"}, {"{{COURSE_NAME}}"}, {"{{COURSE_DURATION}}"}, {"{{START_DATE}}"}, {"{{END_DATE}}"},{" "}
                {"{{REMUNERATION_AMOUNT}}"}, {"{{PAYMENT_SCHEDULE}}"}, {"{{PAYMENT_DATE}}"}, {"{{LIVE_SESSION_DAY}}"}, {"{{LIVE_SESSION_TIME}}"},{" "}
                {"{{LIVE_SESSION_PLATFORM}}"}, {"{{NOTICE_PERIOD}}"}, {"{{SUPERVISOR_NAME}}"}.
              </p>
              <div className="flex gap-2">
                <Button onClick={save} loading={saving} size="sm">
                  Save Template
                </Button>
                <button type="button" onClick={() => setEditing(null)} className="text-xs font-semibold text-gray-500">
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {error ? (
            <ErrorState message="We couldn't load templates." onRetry={load} />
          ) : templates === null ? (
            <SkeletonList />
          ) : templates.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">No templates yet.</p>
            </Card>
          ) : (
            templates.map((t) => (
              <Card key={t.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{t.name}</p>
                    <p className="text-xs text-gray-500">Version {t.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-xs font-semibold">
                  <button onClick={() => openEdit(t)} className="text-brand-teal hover:underline">
                    Edit
                  </button>
                  <button onClick={() => toggleActive(t)} className="text-gray-500 hover:text-brand-ink">
                    {t.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
