"use client";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable, { type Column } from "@/components/ui/DataTable";
import ErrorState from "@/components/ui/ErrorState";
import { Input, Select } from "@/components/ui/Field";
import { MEMBER_ROLES, ROLE_HELP, ROLE_LABEL, type OrgRole } from "@/lib/org/people";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";

interface Member {
  id: string;
  role: string;
  name: string;
  email: string;
  disabledAt: string | null;
  lastLoginAt: string | null;
  invitePending: boolean;
  courseIds: string[];
}
interface CourseOpt { id: string; title: string }
interface TeamResponse {
  owner: { name: string; email: string; lastLoginAt: string | null };
  members: Member[];
  courses: CourseOpt[];
}

/**
 * The organization's team: the account owner plus any teammates they
 * have invited. Everyone here signs in separately but works on the same
 * organization. An invitation is an emailed link; the link is also shown
 * here once so the owner can pass it on if the email does not arrive.
 */
export default function OrgTeamManager() {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("EDITOR");
  const [inviteCourses, setInviteCourses] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [link, setLink] = useState<{ who: string; url: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();

  const load = useCallback(() => {
    setFailed(false);
    fetch("/api/org/members")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setFormError(null);
    const res = await fetch("/api/org/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, courseIds: role === "INSTRUCTOR" ? inviteCourses : undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) {
      setFormError(typeof body.error === "string" ? body.error : "Could not send the invitation. Try again.");
      return;
    }
    setLink({ who: body.member.name, url: body.setupUrl });
    setName("");
    setEmail("");
    setInviteCourses([]);
    showToast(`Invitation sent to ${body.member.email}.`, "success");
    load();
  }

  async function setMemberRole(member: Member, newRole: string) {
    setBusyId(member.id);
    const res = await fetch(`/api/org/members/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "role", role: newRole }) });
    setBusyId(null);
    if (!res.ok) return showToast("Could not change the role. Try again.", "error");
    showToast(`${member.name} is now ${ROLE_LABEL[newRole as OrgRole].toLowerCase()}.`, "success");
    load();
  }

  async function saveCourses(member: Member, courseIds: string[]) {
    setBusyId(member.id);
    const res = await fetch(`/api/org/members/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "courses", courseIds }) });
    setBusyId(null);
    if (!res.ok) return showToast("Could not save the courses. Try again.", "error");
    showToast(`${member.name} now teaches ${courseIds.length} course${courseIds.length === 1 ? "" : "s"}.`, "success");
    load();
  }

  async function act(member: Member, action: "disable" | "enable" | "resend") {
    setBusyId(member.id);
    const res = await fetch(`/api/org/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      showToast(typeof body.error === "string" ? body.error : "That did not work. Try again.", "error");
      return;
    }
    if (action === "resend") {
      setLink({ who: member.name, url: body.setupUrl });
      showToast(`A new invitation was sent to ${member.email}.`, "success");
    } else {
      showToast(action === "disable" ? `${member.name} can no longer sign in.` : `${member.name} can sign in again.`, "success");
    }
    load();
  }

  async function remove(member: Member) {
    const ok = await confirm({
      title: `Remove ${member.name}?`,
      description: "They will no longer be able to sign in to your organization. You can invite them again later.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setBusyId(member.id);
    const res = await fetch(`/api/org/members/${member.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not remove that person. Try again.", "error");
      return;
    }
    showToast(`${member.name} was removed.`, "success");
    load();
  }

  const columns: Column<Member>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (m) => m.name,
      render: (m) => (
        <div>
          <div className="font-medium text-brand-ink">{m.name}</div>
          <div className="text-xs font-normal text-gray-600">{m.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (m) => m.role,
      render: (m) => (
        <select aria-label={`Role of ${m.name}`} value={m.role} disabled={busyId === m.id} onChange={(e) => setMemberRole(m, e.target.value)} className="min-h-[36px] rounded-lg border border-brand-gray bg-brand-surface px-2 text-sm text-brand-ink">
          {MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      ),
    },
    {
      key: "courses",
      header: "Teaches",
      render: (m) => (m.role === "INSTRUCTOR" ? <CoursePicker key={m.courseIds.join()} options={data?.courses ?? []} value={m.courseIds} busy={busyId === m.id} onSave={(ids) => saveCourses(m, ids)} label={`Courses taught by ${m.name}`} /> : <span className="text-xs text-gray-500">All</span>),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (m) => (m.disabledAt ? 2 : m.invitePending ? 1 : 0),
      render: (m) =>
        m.disabledAt ? <Badge variant="neutral">Disabled</Badge> : m.invitePending ? <Badge variant="warning">Invitation pending</Badge> : <Badge variant="success">Active</Badge>,
    },
    {
      key: "last",
      header: "Last sign-in",
      className: "text-xs text-gray-600",
      sortValue: (m) => (m.lastLoginAt ? new Date(m.lastLoginAt).getTime() : null),
      render: (m) => (m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString("en-GB") : "Never"),
    },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <div className="flex flex-wrap justify-end gap-3 text-xs font-semibold">
          {!m.disabledAt && (
            <button disabled={busyId === m.id} onClick={() => act(m, "resend")} className="text-brand-teal hover:underline disabled:opacity-50">
              {m.invitePending ? "Resend invitation" : "Send new link"}
            </button>
          )}
          <button
            disabled={busyId === m.id}
            onClick={() => act(m, m.disabledAt ? "enable" : "disable")}
            className="text-gray-600 hover:text-brand-teal disabled:opacity-50"
          >
            {m.disabledAt ? "Enable" : "Disable"}
          </button>
          <button disabled={busyId === m.id} onClick={() => remove(m)} className="text-brand-rose hover:underline disabled:opacity-50">
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {modal}
      <Card>
        <h2 className="font-display text-base font-semibold text-brand-ink">Account owner</h2>
        {data ? (
          <p className="mt-1 text-sm text-gray-600">
            {data.owner.name} ({data.owner.email}). The owner can do everything, including billing and the team, and can&apos;t be removed here.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">Loading…</p>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-base font-semibold text-brand-ink">Invite a teammate</h2>
        <p className="mt-1 text-sm text-gray-600">
          They get an email with a link to choose their own password, and they sign in as themselves: what they change is recorded under their name. {ROLE_HELP[role as OrgRole]}
        </p>
        <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            {MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
          <Button type="submit" loading={adding}>
            {adding ? "Sending..." : "Send invitation"}
          </Button>
        </form>
        {role === "INSTRUCTOR" && (
          <fieldset className="mt-3">
            <legend className="text-sm font-semibold text-brand-ink">Courses this instructor teaches</legend>
            <p className="text-xs text-gray-600">They see only these courses&apos; trainees and reports. You can change this later.</p>
            <CourseChecks options={data?.courses ?? []} value={inviteCourses} onChange={setInviteCourses} />
          </fieldset>
        )}
        {formError && (
          <p role="alert" className="mt-2 text-sm text-brand-rose">
            {formError}
          </p>
        )}
        {link && (
          <div className="mt-4 rounded-lg border border-brand-gray bg-brand-mint/30 p-3 text-sm">
            <p className="text-brand-ink">
              If the email to <span className="font-semibold">{link.who}</span> does not arrive, send them this link. It works once and expires in 48 hours.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input readOnly aria-label="Invitation link" value={link.url} className="w-full rounded-lg border border-brand-gray bg-brand-surface px-2 py-1.5 text-xs text-brand-ink" onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(link.url).then(() => showToast("Link copied.", "success")).catch(() => showToast("Select the link and copy it.", "info"))}
                className="shrink-0 text-xs font-semibold text-brand-teal hover:underline"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </Card>

      <section className="mt-6" aria-labelledby="team-list">
        <h2 id="team-list" className="font-display text-lg font-semibold text-brand-ink">
          Teammates
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Disabling or removing someone stops new sign-ins. A session they already have open stays active until it expires.
        </p>
        <div className="mt-3">
          {failed ? (
            <ErrorState message="Could not load your team." onRetry={load} />
          ) : (
            <DataTable
              caption="Your teammates"
              rows={data ? data.members : null}
              rowKey={(m) => m.id}
              columns={columns}
              empty={<p className="rounded-xl border border-dashed border-brand-gray p-6 text-center text-sm text-gray-600">No teammates yet. Invite someone above.</p>}
            />
          )}
        </div>
      </section>
    </>
  );
}

function CourseChecks({ options, value, onChange }: { options: CourseOpt[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (!options.length) return <p className="mt-1 text-xs text-gray-600">You have no courses yet.</p>;
  return (
    <div className="mt-1 grid gap-1 sm:grid-cols-2">
      {options.map((c) => (
        <label key={c.id} className="flex min-h-[36px] items-center gap-2 text-sm text-brand-ink">
          <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
          <span className="[overflow-wrap:anywhere]">{c.title}</span>
        </label>
      ))}
    </div>
  );
}

/** An instructor's courses: a summary that opens into checkboxes with a Save button. */
function CoursePicker({ options, value, busy, onSave, label }: { options: CourseOpt[]; value: string[]; busy: boolean; onSave: (ids: string[]) => void; label: string }) {
  const [ids, setIds] = useState(value);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-brand-teal" aria-label={label}>{value.length ? `${value.length} course${value.length === 1 ? "" : "s"}` : "None yet: choose"}</summary>
      <CourseChecks options={options} value={ids} onChange={setIds} />
      <button type="button" disabled={busy} onClick={() => onSave(ids)} className="mt-1 text-xs font-semibold text-brand-teal hover:underline disabled:opacity-50">Save courses</button>
    </details>
  );
}
