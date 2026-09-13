"use client";
import { useState } from "react";

interface OutlineLesson {
  id: string;
  title: string;
}
interface OutlineModule {
  id: string;
  title: string;
  lessons: OutlineLesson[];
}

/**
 * Course catalogue upgrade — the module/lesson-title outline shown on
 * the marketing page. Feature-specific rather than a generic
 * ui/Accordion primitive: no second, unrelated use case exists
 * anywhere in this app to justify one, and this needs nothing a
 * generic accordion would offer beyond "one section open at a time."
 */
export default function CourseOutlineAccordion({ modules }: { modules: OutlineModule[] }) {
  const [openId, setOpenId] = useState<string | null>(modules[0]?.id ?? null);

  if (modules.length === 0) return null;

  return (
    <div className="divide-y divide-brand-gray overflow-hidden rounded-lg border border-brand-gray">
      {modules.map((m, i) => {
        const isOpen = openId === m.id;
        return (
          <div key={m.id}>
            <button
              onClick={() => setOpenId(isOpen ? null : m.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-mint/20"
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-brand-ink">
                Module {i + 1} — {m.title}
              </span>
              <span className="shrink-0 text-gray-400">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <ul className="space-y-1.5 bg-brand-sand/30 px-4 pb-4 pt-1">
                {m.lessons.length === 0 && <li className="text-sm italic text-gray-400">No lessons added yet.</li>}
                {m.lessons.map((l, li) => (
                  <li key={l.id} className="text-sm text-gray-700">
                    {li + 1}. {l.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
