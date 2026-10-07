"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface Row {
  id: string;
  name: string;
  score: number;
  status: "Passed" | "In progress";
}
const ROWS: Row[] = [
  { id: "1", name: "Amara Nwosu", score: 82, status: "Passed" },
  { id: "2", name: "Tunde Bello", score: 64, status: "In progress" },
  { id: "3", name: "Zainab Musa", score: 91, status: "Passed" },
];
const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Trainee", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "score", header: "Score", align: "right", sortValue: (r) => r.score, render: (r) => `${r.score}%` },
  { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <Badge variant={r.status === "Passed" ? "success" : "warning"}>{r.status}</Badge> },
];

/** Live examples of the shared components. Every one here is the real component, not a picture of it. */
export default function DesignSystemDemos() {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(true);
  const [name, setName] = useState("");
  const { showToast } = useToast();

  return (
    <div className="space-y-10">
      <Block title="Buttons" note="Button: four variants, three sizes, loading and icon slots. Renders a real link when given an href.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Block>

      <Block title="Form fields" note="Input, Select, Textarea and Checkbox: label tied to the control, hint, error announced as an alert, themed surface.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} hint="As it should appear on your certificate." required />
          <Input label="Email" type="email" error="Enter a valid email address." defaultValue="not-an-email" />
          <Select label="Level" defaultValue="beginner">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
          </Select>
          <Textarea label="Notes" rows={3} placeholder="Anything we should know?" />
          <Input label="Search" hideLabel compact placeholder="A compact field with a hidden label" />
          <Checkbox label="Email me when a result is ready" defaultChecked />
        </div>
      </Block>

      <Block title="Badges, cards and switch" note="Badge, Card (default, highlighted, celebratory) and Toggle.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="gold">Gold</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card>Default card</Card>
          <Card variant="highlighted">Highlighted card</Card>
          <Card variant="celebratory">Celebratory card, for achievements only</Card>
        </div>
        <div className="mt-4 flex items-center gap-3 text-sm">
          <Toggle checked={on} onChange={setOn} label="Example switch" />
          <span>{on ? "On" : "Off"}</span>
        </div>
      </Block>

      <Block title="Feedback" note="Toast (errors are announced as alerts), Modal with focus trap, EmptyState, ErrorState and Skeleton.">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => showToast("Saved your changes.", "success")}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => showToast("Could not save. Check your connection.", "error")}>
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Open dialog
          </Button>
        </div>
        <Modal open={open} onClose={() => setOpen(false)} title="Example dialog" size="sm">
          <p className="mt-2 text-sm text-gray-600">Focus is trapped here. Press Escape or choose Close to return to the page.</p>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => setOpen(false)}>Close</Button>
          </div>
        </Modal>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="Nothing here yet" description="Say what will appear and how to add the first one." />
          <div className="space-y-4">
            <ErrorState message="We could not load this list." onRetry={() => showToast("Retrying…", "info")} />
            <SkeletonList rows={2} />
          </div>
        </div>
      </Block>

      <Block title="Navigation and data" note="Breadcrumbs and DataTable: sortable columns, search, paging, and cards on a phone.">
        <Breadcrumbs items={[{ label: "Courses", href: "#" }, { label: "Python Foundations", href: "#" }, { label: "Results" }]} />
        <div className="mt-4">
          <DataTable caption="Example results" rows={ROWS} rowKey={(r) => r.id} columns={COLUMNS} searchText={(r) => r.name} searchLabel="Search trainees" />
        </div>
      </Block>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`ds-${title.replace(/\W+/g, "-").toLowerCase()}`}>
      <h2 id={`ds-${title.replace(/\W+/g, "-").toLowerCase()}`} className="font-display text-lg font-semibold text-brand-ink">
        {title}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-gray-600">{note}</p>
      <div className="mt-4 rounded-xl border border-brand-gray bg-brand-surface p-5">{children}</div>
    </section>
  );
}
