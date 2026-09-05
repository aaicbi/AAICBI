"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface OptionDto {
  id: string;
  text: string;
  isCorrect: boolean;
}
interface SourceQuestionDto {
  id: string;
  text: string;
  options: { text: string; isCorrect: boolean }[];
}
interface QuestionDto {
  id: string;
  text: string;
  needsReview: boolean;
  reviewReason: string | null;
  options: OptionDto[];
  generatedFromQuestion: SourceQuestionDto | null;
}
interface ExamDto {
  id: string;
  title: string;
  published: boolean;
  questions: QuestionDto[];
}

const DISAGREEMENT_MARKER = "Self-consistency check disagreed";

/**
 * M21 — the review screen for a course examination's AI-generated
 * questions. Reuses the existing, generic question approve/edit/delete
 * routes (/api/questions/[id]) unchanged — see this project's own
 * roadmap comment on why that works for a course exam's questions with
 * zero adaptation: ownership is checked against `exam.createdById`
 * directly, not traced through a module that a course exam doesn't
 * have.
 */
export default function CourseExaminationPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<ExamDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const { showToast } = useToast();

  function load() {
    fetch(`/api/courses/${params.id}/examination`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        setExam(await r.json());
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function generate() {
    setGenerating(true);
    const res = await fetch(`/api/courses/${params.id}/examination/generate`, { method: "POST" });
    setGenerating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not generate questions.", "error");
      return;
    }
    const data = await res.json();
    const remainingNote = data.remaining > 0 ? ` ${data.remaining} more source question(s) left — click "Generate More" again to continue.` : "";
    showToast(`Generated ${data.generated} question(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}.${remainingNote}`, "success");
    load();
  }

  async function approve(questionId: string) {
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });
    if (!res.ok) {
      showToast("Could not approve. Try again.", "error");
      return;
    }
    showToast("Approved.", "success");
    load();
  }

  async function saveEdit(questionId: string) {
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText, approve: true }),
    });
    if (!res.ok) {
      showToast("Could not save. Try again.", "error");
      return;
    }
    setEditingId(null);
    showToast("Saved and approved.", "success");
    load();
  }

  async function reject(questionId: string) {
    const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not reject. Try again.", "error");
      return;
    }
    showToast("Rejected — the question has been removed.", "success");
    load();
  }

  async function publish() {
    if (!exam) return;
    setPublishing(true);
    const res = await fetch(`/api/exams/${exam.id}/publish`, { method: "POST" });
    setPublishing(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not publish.", "error");
      return;
    }
    showToast("Course examination published.", "success");
    load();
  }

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          No course examination has been generated yet.
          <div className="mt-4">
            <Button onClick={generate} loading={generating}>
              Generate Course Examination
            </Button>
          </div>
        </main>
      </>
    );
  }
  if (!exam) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <SkeletonList />
        </main>
      </>
    );
  }

  // M21 — disagreement-flagged questions sort first, matching the
  // roadmap's own "flagged and sorted to the top of the review queue"
  // description: those are the ones most worth a reviewer's attention
  // first, not just whichever happened to generate earliest.
  const sortedQuestions = [...exam.questions].sort((a, b) => {
    const aFlagged = a.reviewReason?.includes(DISAGREEMENT_MARKER) ? 0 : 1;
    const bFlagged = b.reviewReason?.includes(DISAGREEMENT_MARKER) ? 0 : 1;
    return aFlagged - bFlagged;
  });
  const outstandingCount = exam.questions.filter((q) => q.needsReview).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{exam.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {exam.questions.length} question(s) · {outstandingCount} awaiting review
              {exam.published && <Badge variant="success">Published</Badge>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={generate} loading={generating}>
              Generate More
            </Button>
            {!exam.published && (
              <Button onClick={publish} loading={publishing}>
                Publish
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sortedQuestions.map((q) => {
            const disagreement = q.reviewReason?.includes(DISAGREEMENT_MARKER);
            return (
              <Card key={q.id} className={disagreement ? "border-2 border-brand-rose" : undefined}>
                <div className="flex items-start justify-between gap-3">
                  {editingId === q.id ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded-lg border border-brand-gray p-2 text-sm"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm font-medium text-brand-ink">{q.text}</p>
                  )}
                  {q.needsReview && (
                    <Badge variant={disagreement ? "danger" : "warning"}>{disagreement ? "Disagreement" : "Needs review"}</Badge>
                  )}
                </div>

                <ul className="mt-2 space-y-1">
                  {q.options.map((o) => (
                    <li key={o.id} className={`text-xs ${o.isCorrect ? "font-semibold text-brand-teal" : "text-gray-600"}`}>
                      {o.isCorrect ? "✓ " : "· "}
                      {o.text}
                    </li>
                  ))}
                </ul>

                {q.reviewReason && <p className="mt-2 text-xs text-gray-500">{q.reviewReason}</p>}

                {q.generatedFromQuestion && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-500">Generated from this module-bank question:</p>
                    <p className="mt-1 text-xs text-gray-700">{q.generatedFromQuestion.text}</p>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {editingId === q.id ? (
                    <>
                      <Button onClick={() => saveEdit(q.id)}>Save &amp; Approve</Button>
                      <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-gray-500">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {q.needsReview && <Button onClick={() => approve(q.id)}>Approve</Button>}
                      <button
                        onClick={() => {
                          setEditingId(q.id);
                          setEditText(q.text);
                        }}
                        className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold text-brand-ink"
                      >
                        Edit
                      </button>
                      <button onClick={() => reject(q.id)} className="text-xs font-semibold text-brand-rose">
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
