/**
 * Importing reviewed content into a module: the part that reads and writes the database. The checking and planning is in
 * contentImport.ts (pure). Everything imported waits for a person:
 *   - quiz questions arrive as "passed review", for the games and practice side, so the bank panel's Approve button makes them live;
 *   - matching, ordering and scenario items arrive as DRAFT, so the studio's Approve button makes them live;
 *   - the games are created and attached to the module but left switched off.
 * Running it twice imports nothing twice.
 */
import { prisma } from "@/lib/prisma";
import { FORMAT_INFO, type GameFormat } from "@/lib/quest/games";
import { FILE_FORMATS, GAME_FORMAT_OF, itemSignature, parseContentFile, planImport, type ContentFile, type ImportPlan } from "@/lib/quest/contentImport";

export class ImportError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function examCodeFor(title: string): string {
  const slug = title.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  return `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function loadModule(moduleId: string, file: ContentFile) {
  const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true, title: true } });
  if (!mod) throw new ImportError("That module could not be found.", 404);
  const objectives = await prisma.moduleLearningObjective.findMany({ where: { moduleId }, orderBy: { order: "asc" }, select: { id: true, text: true, order: true } });
  const exam = await prisma.exam.findUnique({ where: { moduleId }, select: { id: true } });
  const known = new Set<string>();
  if (exam) {
    for (const q of await prisma.question.findMany({ where: { examId: exam.id, bankStatus: { not: null } }, select: { text: true } })) known.add(itemSignature("quiz", { question: q.text }));
  }
  const items = await prisma.gameItem.findMany({ where: { moduleId }, select: { format: true, content: true } });
  for (const i of items) {
    const kind = (Object.keys(GAME_FORMAT_OF) as (keyof typeof GAME_FORMAT_OF)[]).find((k) => GAME_FORMAT_OF[k] === i.format);
    if (kind) known.add(itemSignature(kind, i.content));
  }
  void file;
  return { mod, objectives, exam, known };
}

/** What importing this file into this module would do. Saves nothing. */
export async function previewImport(moduleId: string, raw: unknown): Promise<{ moduleTitle: string; plan: ImportPlan }> {
  const parsed = parseContentFile(raw);
  if (!parsed.ok) throw new ImportError(parsed.error);
  const { mod, objectives, known } = await loadModule(moduleId, parsed.file);
  return { moduleTitle: mod.title, plan: planImport(parsed.file, objectives, known) };
}

export interface ImportResult {
  objectivesCreated: number;
  objectivesMatched: number;
  questions: number;
  items: Record<"MATCHING" | "ORDERING" | "SCENARIO", number>;
  gamesCreated: string[];
  skippedDuplicates: number;
  skippedInvalid: number;
}

/** Saves the file's content into the module. Quiz questions and game items wait for approval; games are attached but off. */
export async function applyImport(moduleId: string, userId: string, raw: unknown, opts: { createGames: boolean; only?: number[] }): Promise<ImportResult> {
  const parsed = parseContentFile(raw);
  if (!parsed.ok) throw new ImportError(parsed.error);
  const { mod, objectives, exam: foundExam, known } = await loadModule(moduleId, parsed.file);
  // The whole file is planned (so objectives line up the same way every time); `only` limits which objectives are saved in this call,
  // letting a large file be imported one objective at a time inside the server's time limit.
  const plan = planImport(parsed.file, objectives, known);
  const chosen = (i: number) => !opts.only || opts.only.includes(i);
  const result: ImportResult = {
    objectivesCreated: 0,
    objectivesMatched: plan.objectives.filter((o, i) => chosen(i) && o.match.existing).length,
    questions: 0,
    items: { MATCHING: 0, ORDERING: 0, SCENARIO: 0 },
    gamesCreated: [],
    skippedDuplicates: FILE_FORMATS.reduce((n, k) => n + plan.totals[k].duplicate, 0),
    skippedInvalid: FILE_FORMATS.reduce((n, k) => n + plan.totals[k].invalid, 0),
  };

  // Objectives in the file the module doesn't have yet are added, confirmed by the person importing.
  let nextOrder = objectives.reduce((m, o) => Math.max(m, o.order), -1) + 1;
  const objectiveIds: string[] = [];
  for (const [i, o] of plan.objectives.entries()) {
    if (!chosen(i)) {
      objectiveIds.push("");
      continue;
    }
    if (o.match.existing) {
      objectiveIds.push(o.match.existing.id);
      continue;
    }
    if (o.quiz.length + o.items.length === 0) {
      objectiveIds.push("");
      continue;
    }
    const made = await prisma.moduleLearningObjective.create({ data: { moduleId, text: o.text.slice(0, 400), order: nextOrder++, confirmedById: userId }, select: { id: true } });
    result.objectivesCreated++;
    objectiveIds.push(made.id);
  }

  const totalQuestions = plan.objectives.reduce((n, o, i) => n + (chosen(i) ? o.quiz.length : 0), 0);
  let exam = foundExam;
  if (!exam && totalQuestions > 0) {
    try {
      exam = await prisma.exam.create({ data: { title: `${mod.title} — Assessment`, code: examCodeFor(`${mod.title} Assessment`), moduleId, createdById: userId, published: false }, select: { id: true } });
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
      exam = await prisma.exam.findUniqueOrThrow({ where: { moduleId }, select: { id: true } });
    }
  }

  // A handful of bulk inserts per objective (not one query per row), so a whole module fits comfortably in one request.
  for (const [idx, o] of plan.objectives.entries()) {
    const objectiveId = objectiveIds[idx];
    if (!objectiveId) continue;
    if (o.quiz.length > 0) {
      const made = await prisma.question.createManyAndReturn({
        data: o.quiz.map((q) => ({
          examId: exam!.id,
          text: q.question,
          explanation: q.explanation,
          needsReview: true,
          reviewReason: "Imported after being written and reviewed outside the platform. Waiting for your approval.",
          bankStatus: "VALIDATED_PASS" as const,
          bankObjectiveId: objectiveId,
          bankPool: "PRACTICE" as const,
        })),
        select: { id: true },
      });
      await prisma.option.createMany({ data: made.flatMap((m, qi) => o.quiz[qi].options.map((x, i) => ({ questionId: m.id, text: x.text, isCorrect: x.isCorrect, key: String.fromCharCode(65 + i), order: i }))) });
      await prisma.questionBankEvent.createMany({ data: made.map((m) => ({ questionId: m.id, fromStatus: null, toStatus: "VALIDATED_PASS" as const, kind: "IMPORTED_REVIEWED", note: "Imported from a reviewed content file", actedById: userId })) });
      result.questions += made.length;
    }
    if (o.items.length > 0) {
      await prisma.gameItem.createMany({ data: o.items.map((i) => ({ moduleId, objectiveId, format: i.format, content: i.content as object, status: "DRAFT" as const, source: "IMPORT" })) });
      for (const i of o.items) result.items[i.format as "MATCHING" | "ORDERING" | "SCENARIO"]++;
    }
  }

  if (opts.createGames) {
    // Decided from what the module holds now, so it works when the file is imported one objective at a time.
    const hasQuestions = (await prisma.question.count({ where: { exam: { moduleId }, bankStatus: { not: null } } })) > 0;
    const itemFormats = new Set((await prisma.gameItem.findMany({ where: { moduleId }, select: { format: true }, distinct: ["format"] })).map((i) => i.format as string));
    const wanted: GameFormat[] = [];
    if (hasQuestions) wanted.push("QUIZ");
    for (const f of ["MATCHING", "ORDERING", "SCENARIO"] as const) if (itemFormats.has(f)) wanted.push(f);
    for (const format of wanted) {
      const already = await prisma.gameAssignment.findFirst({ where: { moduleId, game: { format } }, select: { id: true } });
      if (already) continue;
      const game = await prisma.game.create({ data: { title: `${mod.title}: ${FORMAT_INFO[format].label}`.slice(0, 120), format, description: FORMAT_INFO[format].blurb, createdById: userId }, select: { id: true, title: true } });
      await prisma.gameAssignment.create({ data: { gameId: game.id, moduleId, live: false } });
      result.gamesCreated.push(game.title);
    }
  }
  return result;
}
