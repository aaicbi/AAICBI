/**
 * What a staff member may do in the Game Studio. A Super Admin always may do everything; for everyone
 * else a Super Admin picks the set per person. A person with nothing chosen yet (null) gets the default
 * set below, so nobody who could build games before loses access when this ships.
 */
export type PermissionGroup = "STUDIO" | "PLATFORM";

export const STUDIO_PERMISSIONS = [
  { key: "LOOP", group: "STUDIO", label: "Use Loop", blurb: "Chat with Loop. Without this, Loop is closed to them.", wide: false },
  { key: "GAMES", group: "STUDIO", label: "Make and edit games", blurb: "Create, rename, delete and set rewards for their own games.", wide: false },
  { key: "ITEMS", group: "STUDIO", label: "Write and approve items", blurb: "Add, edit and delete game items, and approve Loop's drafts.", wide: false },
  { key: "ASSIGN", group: "STUDIO", label: "Assign games to modules", blurb: "Attach a game to a module and switch it live or off.", wide: false },
  { key: "QUESTIONS", group: "STUDIO", label: "Question pools and practice settings", blurb: "Split question pools, set practice rules and confirm objectives.", wide: false },
  { key: "BANK_AI", group: "PLATFORM", label: "Generate and validate bank questions", blurb: "Loop drafts exam questions for their own modules and runs the checks. Uses AI credits.", wide: false },
  { key: "ANALYTICS", group: "PLATFORM", label: "Platform analytics and overview", blurb: "Platform numbers, content performance, interests, search demand and module statistics.", wide: true },
  { key: "COHORTS", group: "PLATFORM", label: "Cohort reports", blurb: "List cohorts and read their reports.", wide: true },
  { key: "PEOPLE_DATA", group: "PLATFORM", label: "People and reports", blurb: "Search people and read trainee, employer and staff reports.", wide: true },
  { key: "MESSAGING", group: "PLATFORM", label: "Messaging through Loop", blurb: "Find recipients, read a trainee's conversation, send messages and pause messaging.", wide: true },
] as const;

export type StudioPermission = (typeof STUDIO_PERMISSIONS)[number]["key"];

export const ALL_STUDIO_PERMISSIONS: StudioPermission[] = STUDIO_PERMISSIONS.map((p) => p.key);

/** What a person gets until a Super Admin chooses: the studio's own set. Platform-wide tools are always opt-in. */
export const DEFAULT_STUDIO_PERMISSIONS: StudioPermission[] = STUDIO_PERMISSIONS.filter((p) => p.group === "STUDIO").map((p) => p.key);

/** Reads the stored value (any JSON) into a clean list. Null or garbage means the default set. */
export function permissionsFrom(stored: unknown): StudioPermission[] {
  if (!Array.isArray(stored)) return [...DEFAULT_STUDIO_PERMISSIONS];
  return ALL_STUDIO_PERMISSIONS.filter((k) => stored.includes(k));
}

/** Keeps only known keys, in a stable order. */
export function cleanPermissions(input: unknown): StudioPermission[] {
  return Array.isArray(input) ? ALL_STUDIO_PERMISSIONS.filter((k) => input.includes(k)) : [];
}

/**
 * The permission each Loop tool or action needs. Anything not listed is either one of the engine's own
 * module-scoped reading tools (always allowed, they only see the person's own modules) or not offered to staff.
 */
export const TOOL_PERMISSION: Record<string, StudioPermission> = {
  // studio actions
  create_game: "GAMES",
  set_game_rewards: "GAMES",
  add_game_items: "ITEMS",
  approve_game_items: "ITEMS",
  assign_game: "ASSIGN",
  split_question_pools: "QUESTIONS",
  set_practice_settings: "QUESTIONS",
  save_learning_objectives: "QUESTIONS",
  // question bank
  generate_bank_questions: "BANK_AI",
  run_bank_validation: "BANK_AI",
  // platform reads
  get_platform_overview: "ANALYTICS",
  get_analytics_overview: "ANALYTICS",
  get_analytics_content_performance: "ANALYTICS",
  get_analytics_interest_and_segments: "ANALYTICS",
  get_analytics_search_demand: "ANALYTICS",
  get_analytics_cohorts: "ANALYTICS",
  get_analytics_insights: "ANALYTICS",
  get_module_assessment_stats: "ANALYTICS",
  list_cohorts: "COHORTS",
  get_cohort_report: "COHORTS",
  search_people: "PEOPLE_DATA",
  get_trainee_report: "PEOPLE_DATA",
  get_employer_report: "PEOPLE_DATA",
  get_staff_report: "PEOPLE_DATA",
  // messaging
  resolve_recipients: "MESSAGING",
  get_conversation_messages: "MESSAGING",
  send_message: "MESSAGING",
  suspend_messaging: "MESSAGING",
};

/** Tools the engine itself provides, limited to the person's own modules and games. Everyone who may use Loop has them. */
export const OWN_SCOPE_TOOLS = new Set(["find_module", "get_module_details", "read_module_materials", "list_games", "get_game_items"]);

export function mayUseTool(name: string, permissions: readonly StudioPermission[]): boolean {
  if (OWN_SCOPE_TOOLS.has(name)) return true;
  const needed = TOOL_PERMISSION[name];
  return !!needed && permissions.includes(needed);
}
