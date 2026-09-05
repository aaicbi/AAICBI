"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Create Examination</h1>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Exam Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="AAICBI Excel Assessment — Week 1"
                aria-label="Exam title"
                className="input"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
                rows={2}
              />
            </Field>
            <Field label="Course">
              <input
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Pass mark (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.passMarkPercent}
                  onChange={(e) => setForm({ ...form, passMarkPercent: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Questions per attempt (blank = all)">
                <input
                  type="number"
                  min={1}
                  value={form.numQuestions}
                  onChange={(e) => setForm({ ...form, numQuestions: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Max attempts (blank = unlimited)">
                <input
                  type="number"
                  min={1}
                  value={form.maxAttempts}
                  onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Instructions shown to students">
              <textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                className="input"
                rows={3}
              />
            </Field>

            <div className="space-y-2">
              {[
                ["randomizeQuestions", "Randomize question order"],
                ["randomizeOptions", "Randomize answer option order"],
                ["showResultImmediately", "Show result immediately after submission"],
                ["showCorrectAnswers", "Show correct answers after submission"],
                ["allowReview", "Allow students to review answers before final submit"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    className="h-4 w-4 accent-brand-teal"
                  />
                  {label}
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating..." : "Create & Continue to Import Questions"}
            </Button>
          </form>
        </Card>

        <style jsx global>{`
          .input {
            width: 100%;
            border: 1px solid #d9d9d9;
            border-radius: 0.5rem;
            padding: 0.6rem 0.75rem;
            outline: none;
          }
          .input:focus {
            border-color: #016b61;
          }
        `}</style>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-brand-ink">{label}</label>
      {children}
    </div>
  );
}
