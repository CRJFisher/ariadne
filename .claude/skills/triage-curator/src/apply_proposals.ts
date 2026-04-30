import * as fs from "node:fs/promises";

import {
  parse_known_issues_registry_json,
  serialize_known_issues_registry_json,
} from "@ariadnejs/types";
import { detect_language } from "@ariadnejs/core";

import { error_code } from "./errors.js";
import { render_ariadne_bug_body } from "./render_ariadne_bug_body.js";
import type {
  AriadneBugTaskToCreate,
  BuiltinClassifierSpec,
  ClassifierSpecProposal,
  FalsePositiveGroup,
  SignalLibraryGapTaskToCreate,
  InvestigateResponse,
  InvestigatorSessionLog,
  KnownIssue,
  KnownIssueLanguage,
  QaResponse,
} from "./types.js";

/**
 * Single static parent task for all signal-library-gap sub-tasks emitted by
 * the curator. Sub-task ids are auto-assigned by Backlog.md via `parentTaskId`.
 */
export const SIGNAL_LIBRARY_GAP_PARENT_TASK_ID = "TASK-190.16";

/**
 * Outlier rate at or above which a classifier is considered drifting. Denominator
 * is full group size (sticky registry tag signal). Complementary to
 * `PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD` in `promote_to_investigate.ts`.
 */
export const DRIFT_OUTLIER_RATE_THRESHOLD = 0.15;

// ===== Drift tagging =====

/**
 * For each QA response whose outlier rate meets the drift threshold, flip
 * `drift_detected` to true on the matching registry entry. Pure.
 */
export function mark_drift_in_registry(
  registry: KnownIssue[],
  qa: QaResponse[],
  member_counts: Record<string, number>,
): { updated: KnownIssue[]; drift_tagged_groups: string[] } {
  const drifting = new Set<string>();
  for (const r of qa) {
    const n = member_counts[r.group_id] ?? 0;
    if (n <= 0) continue;
    if (r.outliers.length / n >= DRIFT_OUTLIER_RATE_THRESHOLD) {
      drifting.add(r.group_id);
    }
  }
  const updated = registry.map((issue) =>
    drifting.has(issue.group_id) ? { ...issue, drift_detected: true } : issue,
  );
  return { updated, drift_tagged_groups: [...drifting] };
}

// ===== Observed-count bookkeeping =====

/**
 * Increment `observed_count`, extend `observed_projects`, and set `last_seen_run`
 * on registry entries whose `group_id` appears in the source triage run. Pure.
 *
 * Behaviour:
 * - Groups present in the triage run but absent from the registry are ignored —
 *   `upsert_classifier` is the only path that can mint a new registry entry, and
 *   when it does, this function will increment the entry's counts on the next
 *   pass (the order is drift → upserts → observed bump in `apply_proposals`).
 * - `observed_count` accumulates across runs; re-running the curator on the same
 *   run_id does double-count, which is why finalize's `finalized.json` sentinel
 *   is the guard against redundant invocation.
 */
export function bump_observed_stats(
  registry: KnownIssue[],
  member_counts: Record<string, number>,
  project: string,
  run_id: string,
): { updated: KnownIssue[]; bumped_groups: string[] } {
  const bumped_groups: string[] = [];
  const updated = registry.map((issue) => {
    const count = member_counts[issue.group_id];
    if (count === undefined || count <= 0) return issue;
    bumped_groups.push(issue.group_id);
    const prior_projects = issue.observed_projects ?? [];
    const next_projects = prior_projects.includes(project)
      ? prior_projects
      : [...prior_projects, project];
    return {
      ...issue,
      observed_count: (issue.observed_count ?? 0) + count,
      observed_projects: next_projects,
      last_seen_run: run_id,
    };
  });
  return { updated, bumped_groups };
}

// ===== Spec validation (called from the pre-finalize validator) =====

/**
 * Verify every `positive_examples` / `negative_examples` index is in-range
 * against the source group's entries. Returns a list of human-readable
 * violations (empty when the spec is consistent).
 *
 * A group missing from `member_counts` is treated as "no entries observed";
 * any referenced example is therefore out-of-range.
 */
export function validate_spec_example_indexes(
  inv: InvestigateResponse,
  member_counts: Record<string, number>,
): string[] {
  const spec = inv.classifier_spec;
  if (spec === null) return [];
  const size = member_counts[inv.group_id] ?? 0;
  const errors: string[] = [];
  for (const idx of spec.positive_examples) {
    if (idx < 0 || idx >= size) {
      errors.push(
        `classifier_spec.positive_examples contains index ${idx} but group has ${size} entries`,
      );
    }
  }
  for (const idx of spec.negative_examples) {
    if (idx < 0 || idx >= size) {
      errors.push(
        `classifier_spec.negative_examples contains index ${idx} but group has ${size} entries`,
      );
    }
  }
  return errors;
}

// ===== Orchestrator =====

export interface FailedAuthoring {
  group_id: string;
  reason: string;
}

export interface ApplyOptions {
  dry_run: boolean;
  registry_path: string;
  /** Project name of the source run. Written to `observed_projects` on matched entries. */
  project: string;
  /** Run id of the source run. Written to `last_seen_run` on matched entries. */
  run_id: string;
  /**
   * Map of `retargets_to ?? group_id` → absolute path to the authored
   * `check_<id>.ts` file written in Step 4.5 by the main agent.
   */
  authored_files_by_group: Record<string, string>;
  /**
   * Session logs written alongside each InvestigateResponse. Folded into
   * the summary so finalize can surface failed groups.
   */
  session_logs?: InvestigatorSessionLog[];
  /**
   * Groups from the source triage run, keyed by group_id. Used to derive
   * `languages` on new registry upserts when the classifier spec does not
   * declare a language gate.
   */
  triage_groups?: Record<string, FalsePositiveGroup>;
}

export interface ApplyResult {
  /** Absolute paths of authored files whose registry upsert was accepted. */
  authored_files: string[];
  /**
   * Groups whose builtin classifier could not be landed: authored file is
   * missing, unreadable, or failed language derivation.
   */
  failed_authoring: FailedAuthoring[];
  registry_upserts: string[];
  /**
   * Group IDs whose upsert was skipped because the existing registry entry has
   * `status: "permanent"`. Surfaces promotion attempts that should instead be
   * routed to a human-authored backlog task.
   */
  skipped_permanent_upserts: string[];
  drift_tagged_groups: string[];
  /**
   * Signal-library gaps to file as sub-tasks under
   * `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID`. One per `signal_library_gap` emitted.
   */
  signal_library_gap_tasks: SignalLibraryGapTaskToCreate[];
  /**
   * Ariadne resolver bugs to file as top-level tasks (or attach to
   * `existing_task_id`). One per `ariadne_bug` emitted.
   */
  ariadne_bug_tasks: AriadneBugTaskToCreate[];
}

/**
 * Apply curator proposals. In `dry_run` mode no registry mutation is written;
 * the returned `ApplyResult` describes what *would* have happened.
 *
 * Source authoring (`check_<id>.ts`) happens in Step 4.5 before this call.
 * Backlog task creation happens in the main agent via MCP after this call.
 */
export async function apply_proposals(
  qa: QaResponse[],
  inv: InvestigateResponse[],
  member_counts: Record<string, number>,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  const raw = await fs.readFile(opts.registry_path, "utf8");
  const registry = parse_known_issues_registry_json(raw);

  const { updated: after_drift, drift_tagged_groups } = mark_drift_in_registry(
    registry,
    qa,
    member_counts,
  );

  // Authored files are keyed by the target group id (retargets_to ?? group_id) —
  // the same derivation the renderer uses and finalize looks up by.
  const failed_authoring: FailedAuthoring[] = [];
  const authored_files: string[] = [];
  const rejected_builtin_groups = new Set<string>();
  for (const r of inv) {
    if (r.proposed_classifier?.kind !== "builtin") continue;
    const authored_key = r.retargets_to ?? r.group_id;
    const authored_path = opts.authored_files_by_group[authored_key];
    if (authored_path === undefined || authored_path.length === 0) {
      failed_authoring.push({
        group_id: r.group_id,
        reason: `no authored classifier file recorded for key '${authored_key}'`,
      });
      rejected_builtin_groups.add(r.group_id);
      continue;
    }
    if (!(await is_readable(authored_path))) {
      failed_authoring.push({
        group_id: r.group_id,
        reason: `authored classifier file is missing or unreadable: ${authored_path}`,
      });
      rejected_builtin_groups.add(r.group_id);
      continue;
    }
    authored_files.push(authored_path);
  }

  const registry_upserts: string[] = [];
  const skipped_permanent_upserts: string[] = [];
  let next_registry = after_drift;
  for (const r of inv) {
    if (r.proposed_classifier === null) continue;
    if (rejected_builtin_groups.has(r.group_id)) continue;
    const target_group_id = r.retargets_to ?? r.group_id;
    const existing = next_registry.find((e) => e.group_id === target_group_id);
    let languages: KnownIssueLanguage[];
    if (existing !== undefined) {
      languages = existing.languages;
    } else {
      languages = derive_languages_for_upsert(r, opts.triage_groups?.[r.group_id]);
      if (languages.length === 0) {
        failed_authoring.push({
          group_id: r.group_id,
          reason:
            `cannot derive languages for new registry entry '${target_group_id}': ` +
            "classifier_spec has no language_eq check and the source group's " +
            "member file paths carry no recognizable extension (.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.rs)",
        });
        continue;
      }
    }
    const { registry: after_upsert, skipped_permanent } = upsert_classifier(
      next_registry,
      target_group_id,
      r.proposed_classifier,
      languages,
    );
    if (skipped_permanent) {
      skipped_permanent_upserts.push(target_group_id);
      continue;
    }
    next_registry = after_upsert;
    registry_upserts.push(target_group_id);
  }

  // Observed-stat bookkeeping runs after drift + upsert so newly-minted
  // entries still pick up the current run's counts.
  const { updated: after_observed, bumped_groups } = bump_observed_stats(
    next_registry,
    member_counts,
    opts.project,
    opts.run_id,
  );
  next_registry = after_observed;

  const registry_mutated =
    drift_tagged_groups.length > 0 ||
    registry_upserts.length > 0 ||
    bumped_groups.length > 0;
  if (!opts.dry_run && registry_mutated) {
    await fs.writeFile(
      opts.registry_path,
      serialize_known_issues_registry_json(next_registry),
      "utf8",
    );
  }

  const signal_library_gap_tasks: SignalLibraryGapTaskToCreate[] = [];
  for (const r of inv) {
    const gap = r.signal_library_gap;
    if (gap == null) continue;
    signal_library_gap_tasks.push({
      group_id: r.group_id,
      title: gap.title,
      description: gap.description,
      signals_needed: gap.signals_needed,
    });
  }

  const ariadne_bug_tasks: AriadneBugTaskToCreate[] = [];
  for (const r of inv) {
    const bug = r.ariadne_bug;
    if (bug == null) continue;
    const target_group_id = r.retargets_to ?? r.group_id;
    const target_entry = next_registry.find((e) => e.group_id === target_group_id);
    const description = render_ariadne_bug_body({
      response: r,
      group: opts.triage_groups?.[r.group_id],
      target_entry,
      current_project: opts.project,
    });
    ariadne_bug_tasks.push({
      group_id: r.group_id,
      target_registry_group_id: target_group_id,
      root_cause_category: bug.root_cause_category,
      title: bug.title,
      description,
      existing_task_id: bug.existing_task_id,
    });
  }

  return {
    authored_files,
    failed_authoring,
    registry_upserts,
    skipped_permanent_upserts,
    drift_tagged_groups,
    signal_library_gap_tasks,
    ariadne_bug_tasks,
  };
}

/**
 * Write `backlog_task` back into registry entries after Ariadne-bug tasks have
 * been created. Called by the main agent after Step 6b with a map of
 * target-group-id → resolved TASK-id.
 *
 * Entries absent from the registry are silently skipped (the upsert may have
 * failed earlier, or the entry was rejected for other reasons).
 */
export async function link_ariadne_bug_tasks(
  registry_path: string,
  task_ids_by_target_group_id: Record<string, string>,
): Promise<{ updated_groups: string[] }> {
  const entries = Object.entries(task_ids_by_target_group_id);
  if (entries.length === 0) return { updated_groups: [] };

  const raw = await fs.readFile(registry_path, "utf8");
  const registry = parse_known_issues_registry_json(raw);

  const updated_groups: string[] = [];
  const next = registry.map((issue) => {
    const task_id = task_ids_by_target_group_id[issue.group_id];
    if (task_id === undefined) return issue;
    if (issue.backlog_task === task_id) return issue;
    updated_groups.push(issue.group_id);
    return { ...issue, backlog_task: task_id };
  });

  if (updated_groups.length === 0) return { updated_groups: [] };

  await fs.writeFile(
    registry_path,
    serialize_known_issues_registry_json(next),
    "utf8",
  );
  return { updated_groups };
}

async function is_readable(file_path: string): Promise<boolean> {
  try {
    await fs.access(file_path, fs.constants.R_OK);
    return true;
  } catch (err) {
    if (error_code(err) === "ENOENT" || error_code(err) === "EACCES") return false;
    throw err;
  }
}

/**
 * Derive the `languages` field for a new registry entry. Prefers the
 * classifier spec's own `language_eq` gate (authoritative); falls back to the
 * source group's observed file extensions. Returns a sorted unique list so
 * the on-disk registry diff is stable across runs.
 */
export function derive_languages_for_upsert(
  response: InvestigateResponse,
  group: FalsePositiveGroup | undefined,
): KnownIssueLanguage[] {
  const from_spec = declared_languages(response.classifier_spec);
  if (from_spec.length > 0) return sort_languages(from_spec);
  if (group === undefined) return [];
  const langs = new Set<KnownIssueLanguage>();
  for (const e of group.entries) {
    const lang = detect_language(e.file_path);
    if (lang !== null) langs.add(lang);
  }
  return sort_languages([...langs]);
}

function sort_languages(langs: KnownIssueLanguage[]): KnownIssueLanguage[] {
  return [...langs].sort();
}

function declared_languages(spec: BuiltinClassifierSpec | null): KnownIssueLanguage[] {
  if (spec === null) return [];
  const out = new Set<KnownIssueLanguage>();
  for (const c of spec.checks) {
    if (c.op === "language_eq" && is_known_issue_language(c.value)) {
      out.add(c.value);
    }
  }
  return [...out];
}

function is_known_issue_language(value: string): value is KnownIssueLanguage {
  return value === "typescript" || value === "javascript" || value === "python" || value === "rust";
}

interface UpsertOutcome {
  registry: KnownIssue[];
  skipped_permanent: boolean;
}

function upsert_classifier(
  registry: KnownIssue[],
  group_id: string,
  proposal: ClassifierSpecProposal,
  languages: KnownIssueLanguage[],
): UpsertOutcome {
  const existing_idx = registry.findIndex((e) => e.group_id === group_id);
  if (existing_idx === -1) {
    const placeholder: KnownIssue = {
      group_id,
      title: group_id,
      description: "Proposed by triage-curator investigator — fill in before enabling.",
      status: "wip",
      languages,
      examples: [],
      classifier: proposal,
    };
    return { registry: [...registry, placeholder], skipped_permanent: false };
  }

  const existing = registry[existing_idx];

  // Permanent entries are protected from curator overwrite. Promotion flow
  // routes these to a human-authored backlog task instead.
  if (existing.status === "permanent") {
    return { registry, skipped_permanent: true };
  }

  const next = [...registry];
  // Overwriting with kind:"none" is a "retire" action. Flip status to wip
  // and set drift_detected so the next scan surfaces it for human review.
  if (proposal.kind === "none") {
    next[existing_idx] = {
      ...existing,
      classifier: proposal,
      status: "wip",
      drift_detected: true,
    };
  } else {
    next[existing_idx] = { ...existing, classifier: proposal };
  }
  return { registry: next, skipped_permanent: false };
}
