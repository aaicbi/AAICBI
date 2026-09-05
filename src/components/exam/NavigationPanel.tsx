"use client";

export type QuestionState = "unanswered" | "answered" | "current" | "review";

interface NavigationPanelProps {
  total: number;
  currentIndex: number;
  answeredIndices: Set<number>;
  markedIndices: Set<number>;
  onJump: (index: number) => void;
}

function stateFor(
  index: number,
  currentIndex: number,
  answered: Set<number>,
  marked: Set<number>
): QuestionState {
  if (index === currentIndex) return "current";
  if (marked.has(index)) return "review";
  if (answered.has(index)) return "answered";
  return "unanswered";
}

const STATE_STYLES: Record<QuestionState, string> = {
  unanswered: "bg-gray-100 text-gray-500 border border-brand-gray",
  answered: "bg-brand-teal text-white",
  current: "bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-300",
  review: "bg-amber-400 text-white",
};

export function NavigationGrid({ total, currentIndex, answeredIndices, markedIndices, onJump }: NavigationPanelProps) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const state = stateFor(i, currentIndex, answeredIndices, markedIndices);
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={`h-9 w-9 rounded-md text-xs font-semibold transition-transform hover:scale-105 ${STATE_STYLES[state]}`}
              aria-label={`Question ${i + 1}, ${state}`}
              aria-current={state === "current"}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-gray-600">
        <Legend swatch="bg-gray-100 border border-brand-gray" label="Unanswered" />
        <Legend swatch="bg-brand-teal" label="Answered" />
        <Legend swatch="bg-blue-600" label="Current" />
        <Legend swatch="bg-amber-400" label="Marked for review" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${swatch}`} />
      {label}
    </div>
  );
}
