"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { ACTION_HELP, ACTION_LABEL, CATEGORIES, HIGH_RISK, PERMISSIONS, STAFF_PERMISSIONS, infoOf, key as permKey } from "@/lib/rbac/catalogue";
import { ROLE_TEMPLATES } from "@/lib/rbac/templates";
import { legacyDefaults } from "@/lib/rbac/legacy";

interface CustomRole { key: string; name: string; description: string; permissions: string[] }
interface Detail {
  id: string; name: string; email: string; role: "ADMIN" | "INSTRUCTOR" | "SUPER_ADMIN"; active: boolean; jobTitle: string | null; staffNumber: string | null;
  staffRoleKey: string | null; permissionGrants: string[]; permissionDenies: string[]; untouched: boolean; effective: string[]; createdAt: string;
  history: Array<{ id: string; action: string; by: string; outcome: string; reason: string | null; at: string; added: number; removed: number }>;
}

const STAFF_CATEGORIES = CATEGORIES.filter((c) => c.audience === "staff");
const KEEP = "keep";
const CUSTOM = "custom";
const WHY_HIGH: Record<string, string> = {
  "staff.permissions:assign_permissions": "Can give permissions to other people.",
  "staff.accounts:create": "Can create staff accounts.", "staff.accounts:manage": "Can suspend, reactivate and re-role staff.", "staff.roles:edit": "Can change what every holder of a role may do.",
  "platform.settings:configure": "Can change platform-wide settings.", "platform.features:configure": "Can switch platform features on and off.", "platform.command_center:manage": "Can use the Command Center.",
  "platform.maintenance:manage": "Can pause parts of the platform.", "platform.audit:export": "Can download the audit log.",
  "gaming_studio.access:view": "Opens the Gaming Studio.", "gaming_studio.games:publish": "Can publish and unpublish games for everyone.", "gaming_studio.games:delete": "Can delete games.",
  "gaming_studio.settings:configure": "Can change settings for every game.", "gaming_studio.engine:configure": "Can change how the game engine behaves.",
  "gaming_ops.results:export": "Can download players' results.", "gaming_ops.platform:moderate": "Can moderate games for every organization.",
  "reports.export:export": "Can download reports.", "reports.sensitive:view": "Can see reports with personal details.",
  "billing.fees:manage": "Can manage fees.", "billing.settings:configure": "Can change commercial settings.", "billing.reports:export": "Can download financial reports.",
  "security.logs:view": "Can read security logs.", "security.auth_events:view": "Can read sign-in events.", "security.restrictions:manage": "Can block or limit accounts.", "security.integrations:manage": "Can change connections to other services.",
  "orgs.status:manage": "Can suspend organizations.",
};
const labelOf = (k: string) => { const i = infoOf(k); return i ? `${i.featureLabel}: ${ACTION_LABEL[i.action]}` : k; };

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));

/**
 * One screen to create or change a staff account and decide exactly what that person may do. Sections: A staff information, B role
 * template, C permission categories (view, create, edit, delete, manage, approve, publish, moderate, export, configure, assign permissions, each
 * on its own), D permission summary, E security warnings, F review and save. The server checks every change again; nothing here is trusted.
 */
export default function StaffEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const creating = !id;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [staffNumber, setStaffNumber] = useState(""); const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<"ADMIN" | "INSTRUCTOR">("INSTRUCTOR");
  const [active, setActive] = useState(true);
  const [roleKey, setRoleKey] = useState<string>(CUSTOM);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set(["gaming_studio"]));
  const [q, setQ] = useState("");
  const [compare, setCompare] = useState("");
  const [showSelected, setShowSelected] = useState(false);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([fetch("/api/admin/staff/roles", { cache: "no-store" }), id ? fetch(`/api/admin/staff/${id}/access`, { cache: "no-store" }) : Promise.resolve(null)]);
    if (!r.ok || (d && !d.ok)) { setError("This could not be loaded."); return; }
    setRoles((await r.json()).roles ?? []);
    if (d) {
      const det: Detail = await d.json();
      setDetail(det); setName(det.name); setEmail(det.email); setStaffNumber(det.staffNumber ?? ""); setJobTitle(det.jobTitle ?? "");
      setRole(det.role === "ADMIN" ? "ADMIN" : "INSTRUCTOR"); setActive(det.active);
      setRoleKey(det.untouched ? KEEP : det.staffRoleKey ?? CUSTOM); setSelected(new Set(det.effective));
    }
    setError(null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const templateKeys = (k: string): string[] => (k === KEEP ? legacyDefaults(role) : k === CUSTOM ? [] : ROLE_TEMPLATES.find((t) => t.key === k)?.permissions ?? roles.find((x) => x.key === k)?.permissions ?? []);
  const base = useMemo(() => new Set(templateKeys(roleKey)), [roleKey, role, roles]); // eslint-disable-line react-hooks/exhaustive-deps
  const original = useMemo(() => new Set(detail?.effective ?? []), [detail]);

  const chooseTemplate = (k: string) => { setRoleKey(k); setSelected(new Set(k === KEEP && detail ? detail.effective : templateKeys(k))); };
  const toggle = (k: string, on: boolean) => {
    setSelected((cur) => {
      const n = new Set(cur);
      if (on) n.add(k); else n.delete(k);
      // The Gaming Studio door: closing it closes everything inside.
      if (!on && k === "gaming_studio.access:view") for (const p of PERMISSIONS) if (p.categoryId === "gaming_studio") n.delete(p.key);
      return n;
    });
  };
  const catKeys = (cid: string) => PERMISSIONS.filter((p) => p.categoryId === cid).map((p) => p.key);
  // "Select all" never ticks a high-risk permission: those are always switched on one at a time.
  const selectSafe = (cid: string) => setSelected((cur) => {
    const n = new Set(cur);
    const c = CATEGORIES.find((x) => x.id === cid);
    if (c?.gate && !n.has(c.gate)) return n;
    for (const k of catKeys(cid)) if (!HIGH_RISK.includes(k)) n.add(k);
    return n;
  });
  const clearCat = (cid: string) => setSelected((cur) => { const n = new Set(cur); for (const k of catKeys(cid)) n.delete(k); return n; });

  const needle = q.trim().toLowerCase();
  const visible = (f: (typeof STAFF_CATEGORIES)[number]["features"][number], catLabel: string) => !needle || [f.label, f.description, catLabel, ...f.actions.map((a) => ACTION_LABEL[a])].join(" ").toLowerCase().includes(needle);

  const chosenHigh = [...selected].filter((k) => HIGH_RISK.includes(k));
  const grants = [...selected].filter((k) => !base.has(k));
  const denies = [...base].filter((k) => !selected.has(k));
  const accessChanged = creating ? true : roleKey !== KEEP || !sameSet(selected, original);
  const added = creating ? [...selected] : [...selected].filter((k) => !original.has(k));
  const removed = creating ? [] : [...original].filter((k) => !selected.has(k));

  async function save() {
    setBusy(true); setProblem(null);
    const access = { staffRoleKey: roleKey === KEEP ? CUSTOM : roleKey, grants, denies };
    let res: Response;
    if (creating) {
      res = await fetch("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role, staffNumber, jobTitle, active, ...access }) });
    } else {
      res = await fetch(`/api/admin/staff/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, jobTitle, staffNumber, role, active }) });
      if (res.ok && accessChanged) res = await fetch(`/api/admin/staff/${id}/access`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(access) });
    }
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setReview(false); setProblem(typeof j.error === "string" ? j.error : "That did not save. Check the form and try again."); return; }
    showToast(creating ? "Account created. They will get an email to set their password." : "Saved. It applies on their next request.");
    router.push("/admin/staff");
    router.refresh();
  }

  async function saveAsRole() {
    const nm = window.prompt("Name for this role, for example “Weekend moderator”:");
    if (!nm) return;
    const res = await fetch("/api/admin/staff/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm, permissions: [...selected] }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(typeof j.error === "string" ? j.error : "Could not save the role.", "error"); return; }
    setRoles((r) => [...r, j]); setRoleKey(j.key); showToast("Role saved. You can now give it to other staff.");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!creating && !detail) return <SkeletonList rows={4} />;
  if (detail && detail.role === "SUPER_ADMIN") return <Card><p className="text-sm text-brand-ink">A Super Admin account always has full access and cannot be changed here.</p></Card>;

  const compareKeys = compare ? new Set(templateKeys(compare)) : null;
  const canSave = name.trim().length > 0 && (!creating || /.+@.+\..+/.test(email));

  return (
    <div data-testid="staff-editor" className="space-y-6">
      {/* Section A */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">A. Staff information</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="staff-name" />
          <Input label="Email (their sign-in)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!creating} required data-testid="staff-email" hint={creating ? "They get an email to set their own password." : "The sign-in email cannot be changed here."} />
          <Input label="Staff number (optional)" value={staffNumber} onChange={(e) => setStaffNumber(e.target.value)} maxLength={40} data-testid="staff-number" />
          <Input label="Job title (optional)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={80} data-testid="staff-title" />
          <Select label="Account type" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "INSTRUCTOR")} data-testid="staff-role">
            <option value="INSTRUCTOR">Instructor</option>
            <option value="ADMIN">Admin</option>
          </Select>
          <Select label="Account status" value={active ? "on" : "off"} onChange={(e) => setActive(e.target.value === "on")} data-testid="staff-status" hint={active ? undefined : "A suspended account is signed out on its next request."}>
            <option value="on">Active</option>
            <option value="off">Suspended</option>
          </Select>
        </div>
        <p className="mt-2 text-xs text-gray-600">The account type decides which kind of sign-in they have. What they may actually do is decided below, permission by permission.</p>
      </Card>

      {/* Section B */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">B. Role template</h2>
        <p className="mt-1 text-sm text-gray-700">A template is only a starting point. Choosing one fills in the permissions below, and you can add or remove any single one before saving. Nothing is granted until you save.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Select label="Role" value={roleKey} onChange={(e) => chooseTemplate(e.target.value)} data-testid="staff-template">
            {!creating && detail?.untouched && <option value={KEEP}>Current access (unchanged)</option>}
            <option value={CUSTOM}>Custom: start with nothing</option>
            <optgroup label="Suggested templates">{ROLE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</optgroup>
            {roles.length > 0 && <optgroup label="Your custom roles">{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</optgroup>}
          </Select>
          <Select label="Compare with a template" value={compare} onChange={(e) => setCompare(e.target.value)} data-testid="staff-compare">
            <option value="">Do not compare</option>
            {ROLE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </Select>
        </div>
        <p className="mt-2 text-sm text-gray-700" data-testid="template-help">{roleKey === KEEP ? "This account has never been configured, so it keeps exactly what its account type always allowed. Change anything below to configure it." : roleKey === CUSTOM ? "Nothing is included. Tick exactly what they need." : ROLE_TEMPLATES.find((t) => t.key === roleKey)?.description ?? roles.find((r) => r.key === roleKey)?.description ?? ""}</p>
        {compareKeys && (
          <p className="mt-2 rounded-lg bg-brand-mint p-3 text-sm text-brand-ink" data-testid="compare-result">
            Against the template: <strong>{[...selected].filter((k) => !compareKeys.has(k)).length}</strong> added and <strong>{[...compareKeys].filter((k) => !selected.has(k)).length}</strong> removed.
          </p>
        )}
        <div className="mt-3"><button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" onClick={() => void saveAsRole()} disabled={selected.size === 0} data-testid="save-as-role">Save these permissions as a new role</button></div>
      </Card>

      {/* Section C */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">C. What they can access and do</h2>
        <p className="mt-1 text-sm text-gray-700">Each action is its own permission: being able to view something never lets someone change, publish, delete or export it. A <span className="font-semibold text-brand-rose">⚠ high risk</span> action is never ticked by “select all”.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1"><Input label="Search permissions" value={q} onChange={(e) => setQ(e.target.value)} placeholder="for example publish, billing, chat" data-testid="perm-search" /></div>
          <button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" onClick={() => setOpen(new Set(STAFF_CATEGORIES.map((c) => c.id)))} data-testid="expand-all">Expand all</button>
          <button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" onClick={() => setOpen(new Set())} data-testid="collapse-all">Collapse all</button>
          <button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" aria-pressed={showSelected} onClick={() => setShowSelected((s) => !s)} data-testid="view-selected">{showSelected ? "Hide" : "View"} selected ({selected.size})</button>
        </div>

        {showSelected && (
          <div className="mt-3 rounded-xl border border-brand-gray p-3" data-testid="selected-list">
            {selected.size === 0 ? <p className="text-sm text-gray-700">Nothing is selected.</p> : STAFF_CATEGORIES.map((c) => { const ks = catKeys(c.id).filter((k) => selected.has(k)); return ks.length ? <p key={c.id} className="text-sm text-brand-ink"><strong>{c.label}:</strong> {ks.map(labelOf).join(", ")}</p> : null; })}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {STAFF_CATEGORIES.map((c) => {
            const feats = c.features.filter((f) => visible(f, c.label));
            if (feats.length === 0) return null;
            const have = catKeys(c.id).filter((k) => selected.has(k)).length;
            const doorShut = !!c.gate && !selected.has(c.gate);
            const isOpen = open.has(c.id) || !!needle;
            return (
              <section key={c.id} className="rounded-xl border border-brand-gray" data-testid={`cat-${c.id}`}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button type="button" className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen} onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}>
                    <span aria-hidden className="text-brand-teal">{isOpen ? "▾" : "▸"}</span>
                    <span className="min-w-0"><span className="block font-semibold text-brand-ink">{c.label}</span><span className="block text-xs text-gray-600">{c.description}</span></span>
                  </button>
                  <Badge variant={have > 0 ? "success" : "neutral"}>{have} of {catKeys(c.id).length}</Badge>
                  <button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-3 text-xs font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-50" disabled={doorShut} onClick={() => selectSafe(c.id)} data-testid={`select-${c.id}`}>Select all (safe)</button>
                  <button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-3 text-xs font-semibold text-brand-ink hover:bg-brand-mint" onClick={() => clearCat(c.id)} data-testid={`clear-${c.id}`}>Clear</button>
                </div>
                {isOpen && (
                  <ul className="divide-y divide-brand-gray/60 border-t border-brand-gray/60">
                    {feats.map((f) => (
                      <li key={f.id} className="px-3 py-3">
                        <p className="text-sm font-semibold text-brand-ink">{f.label}</p>
                        {f.description && <p className="text-xs text-gray-600">{f.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {f.actions.map((a) => {
                            const k = permKey(f.id, a);
                            const high = HIGH_RISK.includes(k);
                            const isDoor = k === c.gate;
                            return (
                              <label key={k} className={`flex min-h-[44px] items-center gap-2 text-sm text-brand-ink ${doorShut && !isDoor ? "opacity-50" : ""}`} title={ACTION_HELP[a]}>
                                <input type="checkbox" className="h-5 w-5" checked={selected.has(k)} disabled={doorShut && !isDoor} onChange={(e) => toggle(k, e.target.checked)} data-testid={`perm-${k}`} />
                                <span>{isDoor ? "Access" : ACTION_LABEL[a]}</span>
                                {high && <span className="rounded-full bg-brand-rose/10 px-2 py-0.5 text-xs font-bold text-brand-rose" title={WHY_HIGH[k]}>⚠ high risk</span>}
                              </label>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                    {doorShut && <li className="px-3 py-2 text-xs text-gray-700">Switch on access first. Nothing else in this group works, or appears in their menu, without it.</li>}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </Card>

      {/* Section D and E */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">D. Permission summary</h2>
        <p className="mt-1 text-sm text-brand-ink" data-testid="summary-total"><strong>{selected.size}</strong> of {STAFF_PERMISSIONS.length} permissions selected{creating ? "" : `, ${added.length} added and ${removed.length} removed since the last save`}.</p>
        <ul className="mt-2 grid gap-1 text-sm text-gray-800 sm:grid-cols-2" data-testid="summary-list">
          {STAFF_CATEGORIES.map((c) => { const n = catKeys(c.id).filter((k) => selected.has(k)).length; return <li key={c.id} className={n ? "font-semibold text-brand-ink" : "text-gray-600"}>{c.label}: {n}</li>; })}
        </ul>
        <h2 className="mt-5 font-display text-lg font-semibold text-brand-ink">E. Security warnings</h2>
        {chosenHigh.length === 0 ? <p className="mt-1 text-sm text-gray-700" data-testid="no-warnings">No high-risk permissions are selected.</p> : (
          <ul className="mt-2 space-y-1" data-testid="warnings">
            {chosenHigh.map((k) => <li key={k} className="rounded-lg border border-brand-rose/40 bg-brand-rose/5 p-2 text-sm text-brand-ink"><strong>⚠ {labelOf(k)}.</strong> {WHY_HIGH[k] ?? "High-risk permission."}</li>)}
          </ul>
        )}
      </Card>

      {!creating && detail && detail.history.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-brand-ink">History</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-800" data-testid="staff-history">
            {detail.history.map((h) => <li key={h.id}>{new Date(h.at).toLocaleString()}: {h.action.replace(/_/g, " ").toLowerCase()} by {h.by}{h.action === "PERMISSIONS_CHANGED" ? ` (${h.added} added, ${h.removed} removed)` : ""}{h.outcome === "DENIED" ? ` , refused${h.reason ? `: ${h.reason}` : ""}` : ""}</li>)}
          </ul>
        </Card>
      )}

      {/* Section F */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">F. Save and review</h2>
        {problem && <p role="alert" className="mt-2 text-sm text-brand-rose" data-testid="staff-problem">{problem}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setReview(true)} disabled={!canSave} data-testid="staff-review">Review and save</Button>
          <Button variant="secondary" onClick={() => router.push("/admin/staff")} data-testid="staff-cancel">Cancel</Button>
        </div>
      </Card>

      <Modal open={review} onClose={() => setReview(false)} title={creating ? "Review the new account" : "Review the changes"} size="lg">
        <div data-testid="review-panel" className="space-y-3 text-sm text-brand-ink">
          <p><strong>{name}</strong>{creating ? ` (${email})` : ""} · {role === "ADMIN" ? "Admin" : "Instructor"} · {active ? "Active" : "Suspended"}</p>
          <p>Role template: <strong>{roleKey === KEEP ? "Current access (unchanged)" : roleKey === CUSTOM ? "Custom" : ROLE_TEMPLATES.find((t) => t.key === roleKey)?.name ?? roles.find((r) => r.key === roleKey)?.name}</strong></p>
          {accessChanged ? (
            <>
              <p data-testid="review-counts">{creating ? `${selected.size} permissions will be granted.` : `${added.length} added, ${removed.length} removed.`}</p>
              {added.length > 0 && <p><strong>{creating ? "Granted" : "Added"}:</strong> {added.map(labelOf).join(", ")}</p>}
              {removed.length > 0 && <p><strong>Removed:</strong> {removed.map(labelOf).join(", ")}</p>}
              {chosenHigh.length > 0 && <p className="rounded-lg border border-brand-rose/40 bg-brand-rose/5 p-2" data-testid="review-high"><strong>High-risk permissions:</strong> {chosenHigh.map(labelOf).join(", ")}</p>}
            </>
          ) : <p>Their permissions are not changing.</p>}
          <p className="text-xs text-gray-600">It applies on their next request, including if they are signed in now.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} loading={busy} data-testid="staff-confirm">{creating ? "Create account" : "Save changes"}</Button>
            <Button variant="secondary" onClick={() => setReview(false)}>Back</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
