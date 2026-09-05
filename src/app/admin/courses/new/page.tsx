"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not create the course. Check the title and try again.");
      return;
    }
    const course = await res.json();
    router.push(`/admin/courses/${course.id}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Create Course</h1>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="new-course-title" className="mb-1 block text-sm font-semibold text-brand-ink">
                Course Title
              </label>
              <input
                id="new-course-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Excel for Data Analytics"
                className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-brand-ink">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating..." : "Create & Add Modules"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
