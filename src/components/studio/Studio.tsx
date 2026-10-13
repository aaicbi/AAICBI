"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Gamepad2, Plus, Trash2 } from "lucide-react";
import Icon from "@/components/ui/Icon";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import CommandCenter from "@/components/command/CommandCenter";
import GamePlayer, { type PlayerApi, type PlayItem, type PlayResult } from "@/components/games/GamePlayer";
import ItemForm, { ItemSummary, StatusBadge } from "@/components/studio/ItemParts";
import type { StudioGame, StudioOverview, Workspace } from "@/components/studio/studioTypes";
import { FORMAT_INFO, isItemFormat, type GameFormat } from "@/lib/quest/games";

type PanelTab = "library" | "build" | "preview" | "loop";

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

const REWARD_LABELS: Record<string, string> = {
  ANSWER: "XP for correct answers",
  MISSED_BONUS: "Bonus for fixing a missed question",
  STREAK: "Practice-day streak bonus",
  OBJECTIVE_MASTERED: "Badge and XP when an objective is mastered",
  MODULE_COMPLETED: "Badge and XP when the module is completed",
};

export default function Studio() {
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();
  const [overview, setOverview] = useState<StudioOverview | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<PanelTab>("library");
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFormat, setNewFormat] = useState<GameFormat>("MATCHING");
  const [previewFormat, setPreviewFormat] = useState<GameFormat>("QUIZ");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const game: StudioGame | null = useMemo(() => overview?.games.find((g) => g.id === gameId) ?? null, [overview, gameId]);

  const loadOverview = useCallback(async () => {
    const r = await call("GET", "/api/admin/studio");
    if (r.ok) setOverview(r.json as unknown as StudioOverview);
    else setError(String(r.json.error ?? "Could not load the studio."));
  }, []);

  const loadWorkspace = useCallback(async (id: string | null) => {
    if (!id) return setWorkspace(null);
    const r = await call("GET", `/api/admin/studio/modules/${id}`);
    if (r.ok) setWorkspace(r.json as unknown as Workspace);
    else setError(String(r.json.error ?? "Could not load that module."));
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    void loadWorkspace(moduleId);
  }, [moduleId, loadWorkspace]);

  // The preview follows the selected game's format.
  useEffect(() => {
    if (game) setPreviewFormat(game.format);
    setPreviewIndex(0);
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await Promise.all([loadOverview(), loadWorkspace(moduleId)]);
    setPreviewKey((k) => k + 1);
  }, [loadOverview, loadWorkspace, moduleId]);

  /** Runs a change, shows any problem in words, and refreshes everything that depends on it. */
  async function act(method: string, url: string, body?: unknown, okMessage?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const r = await call(method, url, body);
    setBusy(false);
    if (!r.ok) {
      setError(String(r.json.error ?? "That didn't work. Please try again."));
      return false;
    }
    if (okMessage) showToast(okMessage, "success");
    await refresh();
    return true;
  }

  async function createGame() {
    const ok = await act("POST", "/api/admin/studio/games", { title: newTitle, format: newFormat }, "Game created.");
    if (!ok) return;
    setNewTitle("");
    setCreating(false);
    const r = await call("GET", "/api/admin/studio");
    if (r.ok) {
      const o = r.json as unknown as StudioOverview;
      setOverview(o);
      if (o.games[0]) setGameId(o.games[0].id);
    }
    setTab("build");
  }

  const assignment = workspace && game ? workspace.assignments.find((a) => a.gameId === game.id) ?? null : null;
  const itemFormat = game && isItemFormat(game.format) ? game.format : null;
  const itemsOfFormat = workspace && itemFormat ? workspace.items.filter((i) => i.format === itemFormat) : [];
  const drafts = itemsOfFormat.filter((i) => i.status === "DRAFT").length;
  const approved = itemsOfFormat.filter((i) => i.status === "APPROVED").length;

  const previewApi: PlayerApi = useMemo(
    () => ({
      async next() {
        if (!moduleId) return { done: true };
        const r = await call("POST", `/api/admin/studio/modules/${moduleId}/preview`, { format: previewFormat, index: previewIndex });
        if (!r.ok) return { error: String(r.json.error ?? "Could not load the preview.") };
        if (r.json.empty) return { done: true };
        const j = r.json as unknown as { format: GameFormat; itemId: string; objective: string; status: string; served: PlayItem["served"]; index: number; total: number };
        setPreviewIndex(j.index + 1);
        return { item: { playId: j.itemId, format: j.format, objective: j.objective, served: j.served, status: j.status, index: j.index, total: j.total } };
      },
      async answer(item, response) {
        const r = await call("POST", `/api/admin/studio/modules/${moduleId}/preview/grade`, { format: item.format, itemId: item.playId, response });
        if (!r.ok) return { error: String(r.json.error ?? "Could not check that answer.") };
        return { result: r.json as unknown as PlayResult };
      },
    }),
    // previewIndex is read when the preview loads its next item; the key below restarts it when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleId, previewFormat, previewKey]
  );

  const libraryPanel = (
    <div className="space-y-4">
      <section aria-label="Game library">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-ink">Games</h2>
          <Button size="sm" variant="secondary" onClick={() => setCreating((c) => !c)} iconLeft={<Icon icon={Plus} size="sm" />} data-testid="new-game">
            New game
          </Button>
        </div>
        {creating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createGame();
            }}
            className="mt-2 space-y-2 rounded-2xl border border-brand-gray bg-brand-surface p-3"
          >
            <Input label="Name" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} compact autoFocus />
            <Select label="Format" value={newFormat} onChange={(e) => setNewFormat(e.target.value as GameFormat)} compact>
              {(overview?.formats ?? []).map((f) => (
                <option key={f.format} value={f.format}>
                  {f.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-600">{FORMAT_INFO[newFormat].blurb}</p>
            <Button type="submit" size="sm" loading={busy} disabled={!newTitle.trim() || busy}>
              Create
            </Button>
          </form>
        )}
        <ul className="mt-2 space-y-1.5">
          {(overview?.games ?? []).map((g) => (
            <li key={g.id}>
              <button
                type="button"
                data-testid="game-row"
                aria-pressed={g.id === gameId}
                onClick={() => {
                  setGameId(g.id);
                  setTab("build");
                }}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${g.id === gameId ? "border-brand-action bg-brand-mint/50" : "border-brand-gray bg-brand-surface hover:border-brand-teal"}`}
              >
                <span className="flex items-center gap-2">
                  <Icon icon={Gamepad2} size="sm" className="text-brand-teal" />
                  <span className="min-w-0 flex-1 truncate font-medium text-brand-ink">{g.title}</span>
                </span>
                <span className="mt-0.5 block text-xs text-gray-600">
                  {FORMAT_INFO[g.format].label} · {g.liveModules} live · {g.assignedModules} module{g.assignedModules === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
          {overview && overview.games.length === 0 && <li className="text-xs text-gray-600">No games yet. Create one, or ask Loop to.</li>}
        </ul>
      </section>

      <section aria-label="Modules">
        <h2 className="text-sm font-semibold text-brand-ink">Modules</h2>
        <ul className="mt-2 space-y-1">
          {(overview?.courses ?? []).map((c) => {
            const open = openCourse === c.id || c.modules.some((m) => m.id === moduleId);
            return (
              <li key={c.id}>
                <button type="button" aria-expanded={open} onClick={() => setOpenCourse(open && openCourse === c.id ? null : c.id)} className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-left text-sm font-medium text-brand-ink hover:bg-brand-gray/30">
                  <Icon icon={open ? ChevronDown : ChevronRight} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                </button>
                {open && (
                  <ul className="ml-4 space-y-1 border-l border-brand-gray pl-2">
                    {c.modules.map((m) => {
                      const live = m.assigned.filter((a) => a.live).length;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            data-testid="module-row"
                            aria-pressed={m.id === moduleId}
                            onClick={() => {
                              setModuleId(m.id);
                              setTab("build");
                            }}
                            className={`w-full rounded-xl px-2 py-1.5 text-left text-sm ${m.id === moduleId ? "bg-brand-mint font-semibold text-brand-ink" : "text-gray-700 hover:bg-brand-gray/30"}`}
                          >
                            <span className="block truncate">{m.title}</span>
                            <span className="block text-xs text-gray-500">
                              {m.objectives} objective{m.objectives === 1 ? "" : "s"} · {live} live game{live === 1 ? "" : "s"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );

  const buildPanel = (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-brand-roseLight px-3 py-2 text-sm text-brand-rose" data-testid="studio-error">
          {error}
        </p>
      )}

      {!game && !workspace && (
        <Card className="text-sm text-gray-700">
          <p className="font-semibold text-brand-ink">Welcome to the studio</p>
          <p className="mt-1">Pick a game from the library (or make one), then pick a module to assign it to. Loop on the right can draft the content, and the preview shows exactly what trainees will play.</p>
        </Card>
      )}

      {game && (
        <Card data-testid="game-detail">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-brand-ink">{game.title}</h2>
            <Badge variant="neutral">{FORMAT_INFO[game.format].label}</Badge>
          </div>
          <p className="mt-1 text-xs text-gray-600">{FORMAT_INFO[game.format].blurb}</p>

          <fieldset className="mt-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rewards this game pays</legend>
            <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {Object.entries(REWARD_LABELS).map(([kind, label]) => (
                <Checkbox
                  key={kind}
                  label={label}
                  checked={game.enabledRewards.includes(kind)}
                  disabled={busy}
                  onChange={(e) => void act("PATCH", `/api/admin/studio/games/${game.id}`, { enabledRewards: e.target.checked ? [...game.enabledRewards, kind] : game.enabledRewards.filter((k) => k !== kind) })}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Rewards never affect certificates or the assessment result.</p>
          </fieldset>

          <div className="mt-4 rounded-2xl border border-brand-gray bg-brand-surface p-3">
            <h3 className="text-sm font-semibold text-brand-ink">Assign to {workspace ? workspace.module.title : "a module"}</h3>
            {!workspace ? (
              <p className="mt-1 text-xs text-gray-600">Choose a module in the list on the left.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <Checkbox
                  label={`This game is part of ${workspace.module.title}`}
                  checked={!!assignment}
                  disabled={busy}
                  onChange={(e) => void act("PUT", `/api/admin/studio/games/${game.id}/assign`, { moduleId: workspace.module.id, assigned: e.target.checked, live: false }, e.target.checked ? "Assigned." : "Removed from this module.")}
                />
                <Checkbox
                  label="Live: trainees can play it"
                  hint={
                    game.format === "QUIZ"
                      ? workspace.quest.ready
                        ? "Ready: every objective has enough approved questions."
                        : `Needs ${workspace.quest.minimums.practice} approved practice and ${workspace.quest.minimums.formal} approved formal questions for every objective.`
                      : approved > 0
                        ? `${approved} approved item${approved === 1 ? "" : "s"} ready to play.`
                        : "Approve at least one item first."
                  }
                  checked={!!assignment?.live}
                  disabled={busy || !assignment}
                  onChange={(e) => void act("PUT", `/api/admin/studio/games/${game.id}/assign`, { moduleId: workspace.module.id, assigned: true, live: e.target.checked }, e.target.checked ? "Live for trainees." : "Hidden from trainees.")}
                />
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<Icon icon={Trash2} size="sm" />}
              onClick={async () => {
                const ok = await confirm({ title: `Delete “${game.title}”?`, description: "It is removed from every module and its plays are removed with it. Written items stay with their modules.", confirmLabel: "Delete game", danger: true });
                if (!ok) return;
                if (await act("DELETE", `/api/admin/studio/games/${game.id}`, undefined, "Game deleted.")) setGameId(null);
              }}
            >
              Delete game
            </Button>
          </div>
        </Card>
      )}

      {workspace && (
        <>
          {itemFormat && (
            <Card data-testid="items-card">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-brand-ink">
                  {FORMAT_INFO[itemFormat].itemNoun[0].toUpperCase() + FORMAT_INFO[itemFormat].itemNoun.slice(1)}s for {workspace.module.title}
                </h3>
                <span className="text-xs text-gray-600">
                  {approved} approved · {drafts} draft
                </span>
                {drafts > 0 && (
                  <Button size="sm" className="ml-auto" disabled={busy} onClick={() => void act("POST", `/api/admin/studio/modules/${workspace.module.id}/items/approve`, { format: itemFormat }, "Drafts approved.")} data-testid="approve-all">
                    Approve all {drafts} draft{drafts === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">Loop writes items as drafts. Try them in the preview, then approve. Trainees only ever see approved items.</p>
              <ul className="mt-3 space-y-2">
                {itemsOfFormat
                  .filter((i) => i.status !== "REJECTED")
                  .map((i) => (
                    <li key={i.id} className="rounded-2xl border border-brand-gray bg-brand-surface p-3" data-testid="item-row" data-status={i.status}>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={i.status} />
                        <span className="text-xs text-gray-500">{i.source === "LOOP" ? "Written by Loop" : "Written by staff"}</span>
                        <span className="ml-auto flex gap-1">
                          {i.status !== "APPROVED" && (
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("PATCH", `/api/admin/studio/modules/${workspace.module.id}/items/${i.id}`, { status: "APPROVED" })}>
                              Approve
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act("DELETE", `/api/admin/studio/modules/${workspace.module.id}/items/${i.id}`)} aria-label="Delete this item">
                            <Icon icon={Trash2} size="sm" />
                          </Button>
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ItemSummary item={i} />
                      </div>
                    </li>
                  ))}
                {itemsOfFormat.length === 0 && <li className="text-xs text-gray-600">Nothing written yet. Ask Loop to draft some from the module&apos;s materials, or add one below.</li>}
              </ul>
              <button type="button" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm} className="mt-3 text-xs font-semibold text-brand-teal underline">
                {showForm ? "Hide the form" : "Write one yourself"}
              </button>
              {showForm && (
                <div className="mt-2 rounded-2xl border border-brand-gray p-3">
                  <ItemForm
                    format={itemFormat}
                    objectives={workspace.quest.objectives}
                    busy={busy}
                    onSubmit={(objectiveId, content) => act("POST", `/api/admin/studio/modules/${workspace.module.id}/items`, { objectiveId, format: itemFormat, content }, "Added.")}
                  />
                </div>
              )}
            </Card>
          )}

          <Card data-testid="pools-card">
            <h3 className="text-sm font-semibold text-brand-ink">Quiz questions for {workspace.module.title}</h3>
            <p className="mt-1 text-xs text-gray-600">
              Quiz practice plays from approved questions. Each objective needs at least {workspace.quest.minimums.practice} for practice and {workspace.quest.minimums.formal} for the formal assessment.
            </p>
            {workspace.quest.objectives.length === 0 ? (
              <p className="mt-2 text-xs text-gray-600">No confirmed learning objectives yet. Ask Loop: “Draft learning objectives for this module.”</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {workspace.quest.objectives.map((o) => (
                  <li key={o.id} className="rounded-xl border border-brand-gray bg-brand-surface p-2.5">
                    <p className="text-sm text-brand-ink">{o.text}</p>
                    {o.coverage && (
                      <p className="mt-0.5 text-xs text-gray-600">
                        Practice {o.coverage.practice}/{workspace.quest.minimums.practice} · Formal {o.coverage.formal}/{workspace.quest.minimums.formal} · Not assigned {o.coverage.untagged}
                      </p>
                    )}
                    <Checkbox
                      wrapperClassName="mt-1.5"
                      label="Required to pass the assessment"
                      checked={o.isCritical}
                      disabled={busy}
                      onChange={(e) => {
                        const ids = workspace.quest.objectives.filter((x) => x.isCritical).map((x) => x.id);
                        void act("PUT", `/api/modules/${workspace.module.id}/quest`, { criticalObjectiveIds: e.target.checked ? [...ids, o.id] : ids.filter((x) => x !== o.id) });
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            {workspace.quest.objectives.some((o) => (o.coverage?.untagged ?? 0) > 0) && (
              <Button className="mt-3" size="sm" variant="secondary" disabled={busy} onClick={() => void act("POST", `/api/modules/${workspace.module.id}/quest`, { action: "autoSplit" }, "Questions split between the pools.")} data-testid="auto-split">
                Split unassigned questions (about 40% formal)
              </Button>
            )}
            <a className="mt-3 block text-xs font-semibold text-brand-teal underline" href={`/admin/modules/${workspace.module.id}/quest`}>
              Assign questions one by one (opens the detailed page)
            </a>
          </Card>

          <Card data-testid="gates-card">
            <h3 className="text-sm font-semibold text-brand-ink">Before the formal assessment</h3>
            <Checkbox
              wrapperClassName="mt-2"
              label="Practice first: the assessment opens only after enough practice"
              checked={workspace.quest.settings.practiceBeforeFormal}
              disabled={busy}
              onChange={(e) => void act("PUT", `/api/modules/${workspace.module.id}/quest`, { practiceBeforeFormal: e.target.checked })}
            />
            {workspace.quest.settings.practiceBeforeFormal && (
              <Select
                label="Objectives to master first"
                compact
                wrapperClassName="mt-2 max-w-xs"
                value={String(workspace.quest.settings.practiceRequiredPercent)}
                onChange={(e) => void act("PUT", `/api/modules/${workspace.module.id}/quest`, { practiceRequiredPercent: Number(e.target.value) })}
              >
                {[50, 60, 70, 80, 90, 100].map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </Select>
            )}
          </Card>
        </>
      )}
    </div>
  );

  const previewPanel = (
    <Card className="h-full overflow-y-auto" data-testid="preview-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-brand-ink">Preview</h2>
        <Badge variant="neutral">Nothing is recorded</Badge>
        <Select label="Format" hideLabel compact value={previewFormat} onChange={(e) => { setPreviewFormat(e.target.value as GameFormat); setPreviewIndex(0); setPreviewKey((k) => k + 1); }} wrapperClassName="ml-auto w-40">
          {(overview?.formats ?? []).map((f) => (
            <option key={f.format} value={f.format}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-3">
        {!moduleId ? (
          <p className="text-sm text-gray-600">Choose a module to preview its games.</p>
        ) : (
          <GamePlayer
            key={`${moduleId}-${previewFormat}-${previewKey}`}
            api={previewApi}
            mode="preview"
            onEmpty={previewFormat === "QUIZ" ? "This module has no approved questions to preview yet." : `No ${FORMAT_INFO[previewFormat].itemNoun}s written for this module yet. Ask Loop to draft some.`}
          />
        )}
      </div>
    </Card>
  );

  const tabs: { key: PanelTab; label: string }[] = [
    { key: "library", label: "Library" },
    { key: "build", label: "Build" },
    { key: "preview", label: "Preview" },
    { key: "loop", label: "Loop" },
  ];

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-[560px] flex-col">
      {modal}
      <div role="tablist" aria-label="Studio panels" className="mb-2 flex gap-1 xl:hidden">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} data-testid={`tab-${t.key}`} onClick={() => setTab(t.key)} className={`min-h-[40px] flex-1 rounded-full px-3 text-sm font-semibold ${tab === t.key ? "bg-brand-action text-brand-onAccent" : "bg-brand-gray/40 text-brand-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[17rem_minmax(0,1fr)_26rem]">
        <aside className={`min-h-0 overflow-y-auto ${tab === "library" ? "block" : "hidden xl:block"}`} aria-label="Library">
          {libraryPanel}
        </aside>
        <section className={`min-h-0 overflow-y-auto ${tab === "build" ? "block" : "hidden xl:block"}`} aria-label="Build">
          {buildPanel}
        </section>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)] gap-3 xl:grid-rows-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className={`min-h-0 ${tab === "preview" ? "block" : "hidden xl:block"}`} aria-label="Preview">
            {previewPanel}
          </section>
          <section className={`min-h-0 ${tab === "loop" ? "block" : "hidden xl:block"}`} aria-label="Loop" data-testid="loop-panel">
            <CommandCenter compact studio={{ moduleId, gameId }} onChanged={() => void refresh()} />
          </section>
        </div>
      </div>
    </div>
  );
}
