import type { GameFormat } from "@/lib/quest/games";

export interface StudioGame {
  id: string;
  title: string;
  format: GameFormat;
  description: string | null;
  enabledRewards: string[];
  assignedModules: number;
  liveModules: number;
}

export interface StudioModuleRef {
  id: string;
  title: string;
  objectives: number;
  assigned: { gameId: string; live: boolean }[];
}

export interface StudioCourse {
  id: string;
  title: string;
  modules: StudioModuleRef[];
}

export interface StudioOverview {
  /** What the signed-in person may do (all of it for a Super Admin). */
  permissions: string[];
  games: StudioGame[];
  courses: StudioCourse[];
  formats: { format: GameFormat; label: string; blurb: string; itemNoun: string }[];
}

export interface Coverage {
  practice: number;
  formal: number;
  untagged: number;
  practiceShort: number;
  formalShort: number;
  ok: boolean;
}

export interface WorkspaceItem {
  id: string;
  objectiveId: string;
  format: GameFormat;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  source: string;
  title: string;
  content: Record<string, unknown>;
}

export interface Workspace {
  module: { id: string; title: string; courseId: string; courseTitle: string };
  quest: {
    settings: { practiceEnabled: boolean; practiceBeforeFormal: boolean; practiceRequiredPercent: number; enabledRewards: string[] };
    objectives: { id: string; text: string; isCritical: boolean; coverage?: Coverage; questions: { id: string; text: string; pool: "PRACTICE" | "FORMAL" | null }[] }[];
    ready: boolean;
    minimums: { practice: number; formal: number };
    rewardOptions: { kind: string; label: string }[];
  };
  items: WorkspaceItem[];
  assignments: { id: string; gameId: string; live: boolean; openToVisitors: boolean; title: string; format: GameFormat }[];
}
