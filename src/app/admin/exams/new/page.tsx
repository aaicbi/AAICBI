"use client";
import { useState } from "react";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ADMIN_NAV } from "@/lib/admin/nav";

import { Checkbox, Input, Textarea } from "@/components/ui/Field";
export default function NewExamPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    course: "",
    durationMinutes: 60,
    passMarkPercent: 80,
    numQuestions: "",
    maxAttempts: "",
    randomizeQuestions: true,
    randomizeOptions: true,
    showResultImmediately: true,
    showCorrectAnswers: false,
    allowReview: true,
    instructions:
      "Read each question carefully. Select only one answer. Once the time expires, the examination will be submitted automatically.",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        numQuestions: form.numQuestions ? Number(form.numQuestions) : null,
        maxAttempts: form.maxAttempts ? Number(form.maxAttempts) : null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not create the examination. Check the fields and try again.");
      return;
    }
    const exam = await res.json();
    router.push(`/admin/exams/${exam.id}/import`);
  }

  return (
    <>
      <SiteHeader
        nav={ADMIN_NAV}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <DesktopRecommended what="Creating an examination" />
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Create Examination</h1>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Exam Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="AAICBI Excel Assessment — Week 1" />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <Input label="Course" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Duration (minutes)" type="number" min={1} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
              <Input label="Pass mark (%)" type="number" min={0} max={100} value={form.passMarkPercent} onChange={(e) => setForm({ ...form, passMarkPercent: Number(e.target.value) })} />
              <Input label="Questions per attempt (blank = all)" type="number" min={1} value={form.numQuestions} onChange={(e) => setForm({ ...form, numQuestions: e.target.value })} />
              <Input label="Max attempts (blank = unlimited)" type="number" min={1} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} />
            </div>
            <Textarea label="Instructions shown to students" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={3} />

            <div className="space-y-2">
              {[
                ["randomizeQuestions", "Randomize question order"],
                ["randomizeOptions", "Randomize answer option order"],
                ["showResultImmediately", "Show result immediately after submission"],
                ["showCorrectAnswers", "Show correct answers after submission"],
                ["allowReview", "Allow students to review answers before final submit"],
              ].map(([key, label]) => (
                <Checkbox key={key} label={<>{label}</>} checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
              ))}
            </div>

            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating..." : "Create & Continue to Import Questions"}
            </Button>
          </form>
        </Card>

      </main>
    </>
  );
}

