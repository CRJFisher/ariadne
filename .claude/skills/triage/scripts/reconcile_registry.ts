#!/usr/bin/env node
/**
 * The human-invoked reconciler of the known-issues registry — the registry's
 * analogue of the plan skill's `export_to_backlog.ts`. Detects work the rest
 * of the pipeline has already done and proposes the corresponding mechanical
 * registry writes; the human previews with `--dry-run`, narrows with
 * selectors, and applies. Driven by the `reconcile-registry` skill; never run
 * on the autonomous sweep.
 *
 * ## Signals
 *
 *   1. **wip → fixed** — a fix-bearing Conventional-Commits subject in this
 *      repo's git log (`fix`/`feat` types only) carries a task scope matching
 *      a wip rule's `backlog_task`. Range scopes (`190.17.12-14`) expand via
 *      the shared grammar in `scripts/check-commit-message.ts`; matching is
 *      exact-id, never prefix (`190.22` does not match `190.22.21`).
 *   2. **drift** — each project's latest finalized
 *      `triage_results/<run-id>.json` names registry rules in
 *      `classifier_regressions[]`. Proposes `drift_detected: true` plus the
 *      missing `drift_evidence[]` rows, append-only and deduped by
 *      `entry_index`, so a re-run is idempotent. Malformed or stale published
 *      files are reported and skipped, never fatal.
 *   3. **promote** (`--id <group_id> --promote`) — the human's deliberate
 *      `wip → permanent` flip. Guarded: a rule whose `function_name` is not
 *      registered in core's `BUILTIN_CHECKS` is rejected (the bundled slice
 *      would carry a dangling builtin). After the registry write,
 *      `generate_permanent_data.ts` regenerates the bundled core slice.
 *   4. **delete-by-name** (`--id <group_id>... --fixed --reason "<text>"`) — the
 *      human's deliberate retirement when the subsuming fix landed under a
 *      task scope that does not match the rule's `backlog_task`, so signal 1
 *      cannot see it. Names rules directly like `--promote`, bypasses git-log
 *      matching, requires `--reason`, and cannot combine with `--drift`.
 *      Deletes the named row(s) from the registry and best-effort unlinks each
 *      row's `check_<group_id>.ts` builtin source — git history is the audit
 *      trail. Guarded: a row whose `function_name` is still registered in
 *      core's `BUILTIN_CHECKS` is rejected (the code-side deletion — barrel
 *      entry removed, core rebuilt — must land first). The auto `--fixed`
 *      path (no `--id`) is unchanged — status-only, row untouched.
 *
 * ## Stage (insertion of an agent-authored draft)
 *
 * `--stage <draft-path>` inserts a `classifier-author`-drafted `KnownIssue`
 * into the registry after validating it: schema-check (which enforces the
 * evidence gate, `observed_count >= 1`), reject a duplicate `group_id`, and
 * reject a `builtin` whose `function_name` is not registered in core's
 * `BUILTIN_CHECKS` (fail-loud: the human must place the `check_*.ts` and
 * rebuild core first). Unlike the reconciliation signals above, `--stage` is
 * **dry-run by default** — it prints the entry it would insert and exits;
 * `--apply` performs the write. This asymmetry is deliberate: an insertion
 * grows the permanent-limitations catalog, so it must be opted into.
 *
 * ## Write boundary
 *
 * All registry writes flow through one `atomic_update_registry` transaction
 * per invocation — proposals are re-folded onto the locked read, so a stale
 * preview can never clobber concurrent edits. This file is allowlisted in
 * `registry_writers.test.ts`' `ALLOWED_SERIALIZER_CALLERS`: it calls
 * `serialize_known_issues_registry_json` strictly inside the mutator closure.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 *
 * Usage:
 *   node --import tsx reconcile_registry.ts \
 *     [--dry-run] [--fixed] [--drift] [--id <group_id>...] [--reason <text>] [--promote]
 */

import { readFile, readdir, unlink } from "node:fs/promises";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { atomic_update_registry } from "@ariadnejs/skill-fs";
import {
  analysis_output_dir,
  is_run_id,
  known_issues_registry_path,
  read_triage_results_file,
  repo_root,
  triage_results_dir,
  triage_results_path,
} from "@ariadnejs/skill-protocol";
import type {
  ClassifierRegressionFlag,
  DriftEvidence,
  KnownIssue,
} from "@ariadnejs/types";
import {
  parse_known_issues_registry_json,
  serialize_known_issues_registry_json,
} from "@ariadnejs/types";
import { BUILTIN_CHECKS } from "@ariadnejs/core";

import {
  SUBJECT_REGEX,
  TASK_SCOPE_REGEX,
  expand_task_scope,
} from "../../../../scripts/check-commit-message.js";
import { generate_permanent_data } from "./generate_permanent_data.js";
import { validate_registry } from "../src/known_issues_registry.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: reconcile_registry [--dry-run] [--fixed] [--drift] " +
  "[--id <group_id>...] [--reason <text>] [--promote]\n" +
  "  Name-mode: --id <group_id>... --fixed --reason \"<text>\" deletes the named " +
  "rows directly (no git-log matching) and unlinks their check_*.ts sources.\n" +
  "  Stage: --stage <draft-path> [--apply] validates and inserts an agent-authored " +
  "KnownIssue draft. Dry-run by default; pass --apply to write.\n";

/**
 * Commit types that assert a behavior change landed. A `docs(198)` or
 * `review(198)` commit references the task without fixing anything, so only
 * these types feed the `wip → fixed` signal.
 */
export const FIX_BEARING_COMMIT_TYPES: ReadonlySet<string> = new Set([
  "fix",
  "feat",
]);

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export interface FixedProposal {
  kind: "wip_to_fixed";
  group_id: string;
  backlog_task: string;
  /** The rule's bare task id that a commit scope matched, e.g. `198` or `190.17.13`. */
  matched_scope: string;
  /**
   * The newest matching commit subject, for the preview's audit line —
   * subjects arrive newest-first from `git log`.
   */
  matched_subject: string;
}

export interface DriftProposal {
  kind: "drift_detected";
  group_id: string;
  /** True only when the rule is not yet `drift_detected`. */
  set_drift_flag: boolean;
  /** Rows absent from the rule's `drift_evidence`, deduped by `entry_index`. */
  new_evidence: DriftEvidence[];
  /** The published runs whose `classifier_regressions[]` flagged the rule. */
  flagged_by: { project: string; run_id: string }[];
}

export interface PromoteProposal {
  kind: "promote_to_permanent";
  group_id: string;
}

/**
 * Signal 4 — name-mode deletion. The human names a rule directly
 * (`--id ... --fixed --reason`) when the subsuming fix landed under a task
 * scope that does not match the rule's `backlog_task`, so signal 1 cannot see
 * it. Deletes the row outright — the `reason` survives only in the run's
 * summary output and the human's commit message; git history is the audit
 * trail.
 */
export interface DeleteByNameProposal {
  kind: "delete_by_name";
  group_id: string;
  /** The retirement rationale — the audit line, since no commit subject is cited. */
  reason: string;
}

export type RegistryProposal =
  | FixedProposal
  | DriftProposal
  | PromoteProposal
  | DeleteByNameProposal;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const BACKLOG_TASK_REGEX = /^TASK-(\d+(?:\.\d+)*)$/;

/** `TASK-198` → `198`; null when `backlog_task` is not TASK-shaped. */
export function bare_task_scope(backlog_task: string): string | null {
  const match = BACKLOG_TASK_REGEX.exec(backlog_task);
  return match === null ? null : match[1];
}

/**
 * Parse one commit subject into its Conventional-Commits type and the exact
 * task ids its scope references (range scopes expand via the shared
 * `expand_task_scope`). Null when the subject is not Conventional-Commits
 * shaped or its scope is not task-shaped.
 */
export function parse_commit_subject(
  subject: string,
): { type: string; task_ids: string[] } | null {
  const match = SUBJECT_REGEX.exec(subject);
  if (match === null) return null;
  const groups = match.groups as { type: string; scope: string | undefined };
  if (groups.scope === undefined || !TASK_SCOPE_REGEX.test(groups.scope)) {
    return null;
  }
  return { type: groups.type, task_ids: expand_task_scope(groups.scope) };
}

/**
 * Pick the newest run-id among published `triage_results` filenames. Run-ids
 * are `<commit|nogit>-<iso-ts>`, so raw lexicographic order sorts by commit
 * hash first — compare the timestamp tail instead. Non-run-id filenames are
 * ignored.
 */
export function pick_latest_run_id(filenames: readonly string[]): string | null {
  const run_ids = filenames
    .map((name) => name.replace(/\.json$/, ""))
    .filter((name) => is_run_id(name));
  if (run_ids.length === 0) return null;
  const timestamp_tail = (run_id: string): string =>
    run_id.slice(run_id.indexOf("-") + 1);
  return run_ids.reduce((latest, candidate) =>
    timestamp_tail(candidate) > timestamp_tail(latest) ? candidate : latest,
  );
}

// ---------------------------------------------------------------------------
// Pure detectors
// ---------------------------------------------------------------------------

/**
 * Signal 1 — `wip → fixed`. For each wip rule carrying a `backlog_task`,
 * propose the flip when a fix-bearing commit subject's expanded scope set
 * contains the rule's exact bare task id. One proposal per rule, citing the
 * newest matching subject (`commit_subjects` arrives newest-first).
 */
export function detect_fixed_proposals(
  rules: readonly KnownIssue[],
  commit_subjects: readonly string[],
): FixedProposal[] {
  const parsed_subjects = commit_subjects
    .map((subject) => ({ subject, parsed: parse_commit_subject(subject) }))
    .filter(
      (entry): entry is { subject: string; parsed: { type: string; task_ids: string[] } } =>
        entry.parsed !== null && FIX_BEARING_COMMIT_TYPES.has(entry.parsed.type),
    );

  const proposals: FixedProposal[] = [];
  for (const rule of rules) {
    if (rule.status !== "wip" || rule.backlog_task === undefined) continue;
    const bare_id = bare_task_scope(rule.backlog_task);
    if (bare_id === null) continue;
    const match = parsed_subjects.find((entry) =>
      entry.parsed.task_ids.includes(bare_id),
    );
    if (match === undefined) continue;
    proposals.push({
      kind: "wip_to_fixed",
      group_id: rule.group_id,
      backlog_task: rule.backlog_task,
      matched_scope: bare_id,
      matched_subject: match.subject,
    });
  }
  return proposals;
}

/** One project's latest published `classifier_regressions[]` slice. */
export interface DriftSource {
  project: string;
  run_id: string;
  classifier_regressions: readonly ClassifierRegressionFlag[];
}

export interface DriftDetection {
  proposals: DriftProposal[];
  /** `rule_id`s named by a published run but absent from the registry. */
  unknown_rule_ids: string[];
}

/**
 * Signal 2 — drift. Aggregate every source's flags per rule, drop evidence
 * rows already present on the rule (dedup key: `entry_index`), and propose
 * only when something actually changes — a fully-covered rule yields no
 * proposal, so a re-run after apply proposes nothing.
 */
export function detect_drift_proposals(
  rules: readonly KnownIssue[],
  sources: readonly DriftSource[],
): DriftDetection {
  const rules_by_id = new Map(rules.map((rule) => [rule.group_id, rule]));
  const by_rule = new Map<
    string,
    { evidence: Map<number, DriftEvidence>; flagged_by: { project: string; run_id: string }[] }
  >();
  const unknown_rule_ids: string[] = [];

  for (const source of sources) {
    for (const flag of source.classifier_regressions) {
      if (!rules_by_id.has(flag.rule_id)) {
        if (!unknown_rule_ids.includes(flag.rule_id)) {
          unknown_rule_ids.push(flag.rule_id);
        }
        continue;
      }
      let acc = by_rule.get(flag.rule_id);
      if (acc === undefined) {
        acc = { evidence: new Map(), flagged_by: [] };
        by_rule.set(flag.rule_id, acc);
      }
      acc.flagged_by.push({ project: source.project, run_id: source.run_id });
      for (const entry of flag.flagged_entries) {
        if (!acc.evidence.has(entry.entry_index)) {
          acc.evidence.set(entry.entry_index, {
            entry_index: entry.entry_index,
            evidence_excerpt: entry.evidence_excerpt,
          });
        }
      }
    }
  }

  const proposals: DriftProposal[] = [];
  for (const [group_id, acc] of by_rule) {
    const rule = rules_by_id.get(group_id);
    if (rule === undefined) continue;
    const existing = new Set(
      (rule.drift_evidence ?? []).map((row) => row.entry_index),
    );
    const new_evidence = [...acc.evidence.values()].filter(
      (row) => !existing.has(row.entry_index),
    );
    const set_drift_flag = rule.drift_detected !== true;
    if (!set_drift_flag && new_evidence.length === 0) continue;
    proposals.push({
      kind: "drift_detected",
      group_id,
      set_drift_flag,
      new_evidence,
      flagged_by: acc.flagged_by,
    });
  }
  return { proposals, unknown_rule_ids };
}

// ---------------------------------------------------------------------------
// Pure apply core
// ---------------------------------------------------------------------------

/**
 * Fold proposals onto a rule array, immutably. Re-applies each delta against
 * the rules as they are NOW (the locked read), so a proposal computed from a
 * stale preview degrades to a no-op instead of clobbering: an already-fixed
 * rule stays fixed, already-present evidence rows are not duplicated. Throws
 * on a proposal naming an absent rule (a detector/selector bug) — except a
 * `delete_by_name` proposal, whose target being absent is the idempotent
 * re-run case (the row is already deleted), not a bug.
 */
export function fold_proposals(
  rules: readonly KnownIssue[],
  proposals: readonly RegistryProposal[],
): KnownIssue[] {
  const next = [...rules];
  const index_by_id = new Map(rules.map((rule, i) => [rule.group_id, i]));
  const to_delete = new Set<string>();

  for (const proposal of proposals) {
    const i = index_by_id.get(proposal.group_id);
    if (i === undefined) {
      if (proposal.kind === "delete_by_name") continue;
      throw new Error(
        `proposal targets unknown rule "${proposal.group_id}" — not in the registry`,
      );
    }
    const rule = next[i];
    switch (proposal.kind) {
      case "wip_to_fixed":
        if (rule.status === "wip") next[i] = { ...rule, status: "fixed" };
        break;
      case "delete_by_name":
        to_delete.add(proposal.group_id);
        break;
      case "drift_detected": {
        const existing = rule.drift_evidence ?? [];
        const present = new Set(existing.map((row) => row.entry_index));
        const appended = proposal.new_evidence.filter(
          (row) => !present.has(row.entry_index),
        );
        if (rule.drift_detected === true && appended.length === 0) break;
        next[i] = {
          ...rule,
          drift_detected: true,
          drift_evidence: [...existing, ...appended],
        };
        break;
      }
      case "promote_to_permanent":
        if (rule.status !== "permanent") next[i] = { ...rule, status: "permanent" };
        break;
    }
  }
  if (to_delete.size === 0) return next;
  return next.filter((rule) => !to_delete.has(rule.group_id));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface CliArgs {
  dry_run: boolean;
  fixed: boolean;
  drift: boolean;
  ids: string[];
  promote: boolean;
  /** The retirement rationale for name-mode (`--id ... --fixed`); null otherwise. */
  reason: string | null;
  /**
   * `--fixed` with `--id`: the deliberate direct-retirement flip. Computed once
   * here (the single source of truth) after guard validation, so `run()` reads
   * it instead of re-deriving the condition.
   */
  name_mode: boolean;
  /** Path to a `KnownIssue` draft JSON to insert; null outside stage-mode. */
  stage: string | null;
  /**
   * Stage-mode only: perform the insert. Stage-mode is dry-run BY DEFAULT (the
   * safety asymmetry vs. the reconciliation signals, which apply by default and
   * preview with `--dry-run`), so a write must be opted into with `--apply`.
   */
  apply: boolean;
}

export function parse_argv(argv: string[]): CliArgs {
  const args: CliArgs = {
    dry_run: false,
    fixed: false,
    drift: false,
    ids: [],
    promote: false,
    reason: null,
    name_mode: false,
    stage: null,
    apply: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dry-run":
        args.dry_run = true;
        break;
      case "--fixed":
        args.fixed = true;
        break;
      case "--drift":
        args.drift = true;
        break;
      case "--id":
        // Collect every following token up to the next flag (repeatable selection).
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.ids.push(argv[++i]);
        }
        break;
      case "--promote":
        args.promote = true;
        break;
      case "--reason": {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith("--") || value.trim().length === 0) {
          throw new Error("--reason requires a non-empty value: the retirement rationale");
        }
        args.reason = argv[++i];
        break;
      }
      case "--stage": {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith("--") || value.trim().length === 0) {
          throw new Error("--stage requires a draft file path");
        }
        args.stage = argv[++i];
        break;
      }
      case "--apply":
        args.apply = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.promote && args.ids.length === 0) {
    throw new Error("--promote requires --id <group_id>: promotion is per-rule and deliberate");
  }
  if (args.promote && (args.fixed || args.drift)) {
    throw new Error(
      "--promote cannot combine with --fixed/--drift: promotion is a separate, deliberate transaction",
    );
  }
  // Name-mode is `--fixed` with `--id`: a deliberate, direct deletion that
  // bypasses git-log detection. It requires a `--reason` and cannot mix
  // with `--drift`; `--reason` is valid ONLY in name-mode.
  args.name_mode = args.fixed && args.ids.length > 0;
  if (args.name_mode && args.drift) {
    throw new Error(
      "--fixed --id (name-mode) cannot combine with --drift: name-mode is a deliberate, direct flip",
    );
  }
  if (args.name_mode && args.reason === null) {
    throw new Error(
      "--fixed --id (name-mode) requires --reason <text>: a retirement must record why",
    );
  }
  if (args.reason !== null && !args.name_mode) {
    throw new Error(
      "--reason is valid only with name-mode (--fixed and --id together): no commit subject is cited there",
    );
  }
  // Stage-mode is a standalone insertion transaction: it shares no machinery
  // with the reconciliation signals, so it may not combine with any of them.
  if (args.stage !== null) {
    if (args.fixed || args.drift || args.promote || args.ids.length > 0 || args.reason !== null) {
      throw new Error(
        "--stage cannot combine with --fixed/--drift/--promote/--id/--reason: " +
          "staging a draft is a standalone insertion transaction",
      );
    }
    // --stage is dry-run by default and writes only with --apply; --dry-run
    // would imply it toggles something it does not.
    if (args.dry_run) {
      throw new Error(
        "--stage is dry-run by default; drop --dry-run and pass --apply to write the insert",
      );
    }
  }
  // --apply is the write opt-in for stage-mode; it is meaningless elsewhere.
  if (args.apply && args.stage === null) {
    throw new Error("--apply is valid only with --stage: it opts a draft insertion into writing");
  }
  return args;
}

export interface SkippedSource {
  project: string;
  file: string;
  error: string;
}

export interface ReconcileDeps {
  registry_path: string;
  load_registry: () => Promise<KnownIssue[]>;
  read_commit_subjects: () => string[];
  discover_drift_sources: () => Promise<{
    sources: DriftSource[];
    skipped: SkippedSource[];
  }>;
  /**
   * Bring core's permanent slice in sync with the registry; returns true when
   * the slice differs from a fresh render (and, unless `dry_run`, was
   * rewritten). `preview_rules` substitutes for the on-disk registry so a
   * `--dry-run --promote` previews the slice the promotion would produce.
   */
  regenerate_permanent_slice: (opts: {
    dry_run: boolean;
    preview_rules: KnownIssue[] | null;
  }) => Promise<boolean>;
  /**
   * Read + JSON-parse a draft file. Returns `unknown` — shape validation is the
   * caller's job (`validate_registry`). `run_stage` wraps both a read/parse
   * failure and a schema failure as `StageDraftError`. Injectable so tests
   * never touch disk.
   */
  read_draft: (draft_path: string) => Promise<unknown>;
  /**
   * The `function_name`s core's `BUILTIN_CHECKS` currently exposes. A thunk so
   * tests inject a fake set without importing `@ariadnejs/core`, and the real
   * dep reads the freshly-built barrel.
   */
  known_builtin_names: () => ReadonlySet<string>;
  /**
   * Best-effort unlink of a deleted row's `check_<group_id>.ts` builtin
   * source. Returns the removed path, or null when the file was already gone
   * (the agent's code-side deletion normally removes it first). Injectable so
   * tests never touch the real builtins directory.
   */
  delete_builtin_source: (group_id: string) => Promise<string | null>;
}

export interface RejectedRule {
  group_id: string;
  reason: string;
}

export interface ReconcileSummary {
  dry_run: boolean;
  selectors: { fixed: boolean; drift: boolean; ids: string[]; promote: boolean };
  proposals: {
    wip_to_fixed: FixedProposal[];
    delete_by_name: DeleteByNameProposal[];
    drift_detected: DriftProposal[];
    promote_to_permanent: PromoteProposal[];
  };
  /** `--id` values that matched no proposal (or, under `--promote`, no rule). */
  missing_ids: string[];
  /** `--promote` targets refused: dangling builtin, or already permanent. */
  rejected_promotions: RejectedRule[];
  /** Name-mode targets refused: their builtin is still registered in BUILTIN_CHECKS. */
  rejected_deletions: RejectedRule[];
  /** `check_<group_id>.ts` paths the name-mode run actually unlinked. */
  deleted_builtin_sources: string[];
  /** Published `rule_id`s with no registry rule — review signals, never writes. */
  drift_unknown_rule_ids: string[];
  /** Published files that failed to read/parse; reported, never fatal. */
  skipped_sources: SkippedSource[];
  /**
   * True when the registry write happened. False under `--dry-run`, when
   * nothing was proposed, AND when the folded result was byte-identical to
   * the current registry (an idempotent re-run).
   */
  applied: boolean;
  /**
   * True when core's permanent slice differs from a fresh render of the
   * registry — rewritten on a real `--promote` run, reported-only under
   * `--dry-run` (where the render uses the would-be-promoted rules).
   */
  permanent_slice_changed: boolean;
}

export async function run(
  argv: string[],
  deps: ReconcileDeps,
): Promise<ReconcileSummary> {
  const args = parse_argv(argv);
  const registry = await deps.load_registry();
  const rules_by_id = new Map(registry.map((rule) => [rule.group_id, rule]));

  let fixed_proposals: FixedProposal[] = [];
  const delete_by_name_proposals: DeleteByNameProposal[] = [];
  let drift_proposals: DriftProposal[] = [];
  const promote_proposals: PromoteProposal[] = [];
  let drift_unknown_rule_ids: string[] = [];
  let skipped_sources: SkippedSource[] = [];
  const missing_ids: string[] = [];
  const rejected_promotions: RejectedRule[] = [];
  const rejected_deletions: RejectedRule[] = [];

  if (args.promote) {
    for (const id of args.ids) {
      const rule = rules_by_id.get(id);
      if (rule === undefined) {
        missing_ids.push(id);
      } else if (!deps.known_builtin_names().has(rule.classifier.function_name)) {
        // A builtin whose check_*.ts was deleted after staging: promoting it
        // would bundle a dangling function_name into the permanent slice that
        // only fails when core next builds. --stage guards this at authoring;
        // --promote re-guards it. Checked ahead of already-permanent so the
        // root-cause defect outranks the benign no-op reason.
        rejected_promotions.push({
          group_id: id,
          reason:
            `builtin function_name "${rule.classifier.function_name}" is not registered in ` +
            "core's BUILTIN_CHECKS — place the check_*.ts under " +
            "packages/core/src/classify_entry_points/builtins/, rebuild core " +
            "(pnpm build --filter core), then re-promote",
        });
      } else if (rule.status === "permanent") {
        rejected_promotions.push({ group_id: id, reason: "already permanent" });
      } else {
        promote_proposals.push({ kind: "promote_to_permanent", group_id: id });
      }
    }
  } else if (args.name_mode) {
    // Direct-name retirement: delete each named row without git-log
    // detection. parse_argv guarantees a non-null reason in name-mode.
    if (args.reason === null) {
      throw new Error("name-mode reached with a null reason — parse_argv guard bypassed");
    }
    const reason = args.reason;
    for (const id of args.ids) {
      const rule = rules_by_id.get(id);
      if (rule === undefined) {
        missing_ids.push(id);
      } else if (deps.known_builtin_names().has(rule.classifier.function_name)) {
        // The code-side deletion (agent step 1 of the lifecycle hand-off) has
        // not landed: the barrel still registers the builtin, so deleting the
        // row would leave a live check with no registry rule. Reject with the
        // concrete next action instead of failing later in the bijection test.
        rejected_deletions.push({
          group_id: id,
          reason:
            `builtin function_name "${rule.classifier.function_name}" is still registered in ` +
            "core's BUILTIN_CHECKS — delete its check_*.ts and barrel entry under " +
            "packages/core/src/classify_entry_points/builtins/, rebuild core " +
            "(pnpm build --filter core), then re-run",
        });
      } else {
        delete_by_name_proposals.push({ kind: "delete_by_name", group_id: id, reason });
      }
    }
  } else {
    // No signal flags → both signals (the default preview). `--id` overrides
    // the signal filters: every signal is scanned so a named rule's work
    // surfaces regardless of which transition it belongs to.
    const id_override = args.ids.length > 0;
    const detect_fixed = id_override || args.fixed || !args.drift;
    const detect_drift = id_override || args.drift || !args.fixed;
    if (detect_fixed) {
      fixed_proposals = detect_fixed_proposals(registry, deps.read_commit_subjects());
    }
    if (detect_drift) {
      const discovered = await deps.discover_drift_sources();
      skipped_sources = discovered.skipped;
      const detection = detect_drift_proposals(registry, discovered.sources);
      drift_proposals = detection.proposals;
      drift_unknown_rule_ids = detection.unknown_rule_ids;
    }
    if (args.ids.length > 0) {
      const named = new Set(args.ids);
      fixed_proposals = fixed_proposals.filter((p) => named.has(p.group_id));
      drift_proposals = drift_proposals.filter((p) => named.has(p.group_id));
      const proposed = new Set(
        [...fixed_proposals, ...drift_proposals].map((p) => p.group_id),
      );
      missing_ids.push(...args.ids.filter((id) => !proposed.has(id)));
    }
  }

  const all_proposals: RegistryProposal[] = [
    ...fixed_proposals,
    ...delete_by_name_proposals,
    ...drift_proposals,
    ...promote_proposals,
  ];

  let applied = false;
  if (!args.dry_run && all_proposals.length > 0) {
    applied = await atomic_update_registry(deps.registry_path, async (raw) => {
      const current_rules = parse_known_issues_registry_json(raw);
      const next_rules = fold_proposals(current_rules, all_proposals);
      const next = serialize_known_issues_registry_json(next_rules);
      if (next === raw) return { kind: "noop", result: false };
      return { kind: "write", next, result: true };
    });
  }

  // Registry row gone → its check_<group_id>.ts must not linger. Best-effort
  // even on an idempotent re-run (applied=false): a crash between a prior
  // run's registry write and its unlink leaves the file behind, and this
  // sweep is what recovers it. The builtin-still-registered guard above
  // ensures the barrel no longer imports the file, so unlinking cannot break
  // the build.
  const deleted_builtin_sources: string[] = [];
  if (!args.dry_run) {
    for (const proposal of delete_by_name_proposals) {
      const removed = await deps.delete_builtin_source(proposal.group_id);
      if (removed !== null) deleted_builtin_sources.push(removed);
    }
  }

  let permanent_slice_changed = false;
  const deletes_permanent_row = delete_by_name_proposals.some(
    (proposal) => rules_by_id.get(proposal.group_id)?.status === "permanent",
  );
  if (args.promote || deletes_permanent_row) {
    // Registry first (source of truth), then bring the slice in sync.
    // Unconditional on --promote (not on accepted proposals) so a re-run
    // recovers from a crash between the registry write and the regeneration:
    // the rule is rejected as already-permanent, but the slice still syncs.
    // Name-mode triggers the same sync when it deletes a permanent row.
    // Under --dry-run the would-be-folded rules stand in for the registry
    // so the preview reports the slice change the transition would produce.
    const preview_rules = args.dry_run
      ? fold_proposals(
          registry,
          args.promote ? promote_proposals : delete_by_name_proposals,
        )
      : null;
    permanent_slice_changed = await deps.regenerate_permanent_slice({
      dry_run: args.dry_run,
      preview_rules,
    });
  }

  return {
    dry_run: args.dry_run,
    selectors: { fixed: args.fixed, drift: args.drift, ids: args.ids, promote: args.promote },
    proposals: {
      wip_to_fixed: fixed_proposals,
      delete_by_name: delete_by_name_proposals,
      drift_detected: drift_proposals,
      promote_to_permanent: promote_proposals,
    },
    missing_ids,
    rejected_promotions,
    rejected_deletions,
    deleted_builtin_sources,
    drift_unknown_rule_ids,
    skipped_sources,
    applied,
    permanent_slice_changed,
  };
}

// ---------------------------------------------------------------------------
// Stage: insert an agent-authored draft
// ---------------------------------------------------------------------------

/** A staged draft that failed validation, duplicated a group_id, or named an unregistered builtin. */
export class StageDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StageDraftError";
  }
}

export interface StageSummary {
  /** The validated draft — echoed for the preview / audit line. */
  draft: KnownIssue;
  /** False = dry-run preview only (default); true = inserted via the locked write. */
  applied: boolean;
}

/**
 * Validate an agent-authored `KnownIssue` draft and insert it. The four gates —
 * schema (which enforces the `observed_count >= 1` evidence gate), no duplicate
 * `group_id`, and a builtin `function_name` registered in `BUILTIN_CHECKS` —
 * mirror the lifecycle contract's promotion invariants at the authoring
 * boundary. Dry-run unless `args.apply`; the write folds under the same
 * `atomic_update_registry` lock as `run()`.
 */
export async function run_stage(
  args: CliArgs,
  deps: ReconcileDeps,
): Promise<StageSummary> {
  if (args.stage === null) {
    throw new Error("run_stage reached with a null stage path — dispatch guard bypassed");
  }

  // 1. Read + JSON-parse the draft, wrapping a malformed-JSON parse error as a
  // StageDraftError so every rejection on this path is a StageDraftError.
  let draft: unknown;
  try {
    draft = await deps.read_draft(args.stage);
  } catch (err) {
    throw new StageDraftError(
      `draft at ${args.stage} could not be read/parsed: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }

  // 2. Validate against the KnownIssue schema. validate_registry runs the full
  // per-entry validator (including the evidence gate) and narrows the singleton
  // array to KnownIssuesRegistry, so `entry` is a KnownIssue after it returns.
  const drafts = [draft];
  try {
    validate_registry(drafts);
  } catch (err) {
    throw new StageDraftError(
      `draft at ${args.stage} failed schema validation: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  const entry: KnownIssue = drafts[0];
  const function_name = entry.classifier.function_name;

  // 3. Reject a collision against the current registry — a duplicate group_id
  // OR a builtin function_name already claimed by another rule. The
  // singleton-array validation above cannot see the existing registry, so
  // these cross-rule uniqueness invariants are checked here (and re-checked
  // under the write lock) rather than left to fail on the next load.
  const collision = (rules: readonly KnownIssue[]): StageDraftError | null => {
    if (rules.some((rule) => rule.group_id === entry.group_id)) {
      return new StageDraftError(
        `group_id "${entry.group_id}" already exists in the registry — staging refuses to ` +
          "overwrite; pick a new group_id or edit the existing rule directly",
      );
    }
    const owner = rules.find(
      (rule) => rule.classifier.function_name === function_name,
    );
    if (owner !== undefined) {
      return new StageDraftError(
        `builtin function_name "${function_name}" is already used by rule "${owner.group_id}" — ` +
          "each builtin classifier must have a unique function_name",
      );
    }
    return null;
  };
  const registry = await deps.load_registry();
  const pre_lock_collision = collision(registry);
  if (pre_lock_collision !== null) throw pre_lock_collision;

  // 4. Fail-loud if the function_name is not registered in BUILTIN_CHECKS: the
  // human must place the check_*.ts and rebuild core before staging.
  if (!deps.known_builtin_names().has(function_name)) {
    throw new StageDraftError(
      `builtin function_name "${function_name}" is not registered in ` +
        "core's BUILTIN_CHECKS — place the check_*.ts under " +
        "packages/core/src/classify_entry_points/builtins/, rebuild core " +
        "(pnpm build --filter core), then re-stage",
    );
  }

  // 5. Dry-run by default: preview and exit without writing.
  if (!args.apply) {
    return { draft: entry, applied: false };
  }

  // 6. Insert through the locked write, re-checking the collision under the
  // lock so a concurrent insert of the same group_id or function_name cannot
  // be clobbered.
  const applied = await atomic_update_registry(deps.registry_path, async (raw) => {
    const current_rules = parse_known_issues_registry_json(raw);
    const under_lock_collision = collision(current_rules);
    if (under_lock_collision !== null) throw under_lock_collision;
    const next = serialize_known_issues_registry_json([...current_rules, entry]);
    return { kind: "write", next, result: true };
  });

  return { draft: entry, applied };
}

/**
 * Dispatch entry point: `--stage` routes to `run_stage` (its own summary
 * shape); everything else routes to `run`. Keeps the two modes' summaries
 * precise rather than widening one to carry the other's always-empty fields.
 */
export async function run_or_stage(
  argv: string[],
  deps: ReconcileDeps,
): Promise<ReconcileSummary | StageSummary> {
  const args = parse_argv(argv);
  if (args.stage !== null) return run_stage(args, deps);
  return run(argv, deps);
}

// ---------------------------------------------------------------------------
// Real-world deps
// ---------------------------------------------------------------------------

export async function build_real_deps(): Promise<ReconcileDeps> {
  const registry_path = known_issues_registry_path();
  return {
    registry_path,
    load_registry: async () =>
      parse_known_issues_registry_json(await readFile(registry_path, "utf8")),
    read_commit_subjects: () =>
      execSync("git log --format=%s --no-merges", {
        encoding: "utf8",
        cwd: repo_root(),
        maxBuffer: 64 * 1024 * 1024,
      })
        .split("\n")
        .filter((line) => line.length > 0),
    discover_drift_sources: async () => {
      const sources: DriftSource[] = [];
      const skipped: SkippedSource[] = [];
      const projects = await readdir(analysis_output_dir(), { withFileTypes: true })
        .then((entries) => entries.filter((e) => e.isDirectory()).map((e) => e.name))
        .catch(() => [] as string[]);
      for (const project of projects) {
        const filenames = await readdir(triage_results_dir(project)).catch(
          () => [] as string[],
        );
        const run_id = pick_latest_run_id(filenames);
        if (run_id === null) continue;
        const file = triage_results_path(project, run_id);
        try {
          const results = await read_triage_results_file(file);
          sources.push({
            project,
            run_id,
            classifier_regressions: results.classifier_regressions,
          });
        } catch (err) {
          skipped.push({
            project,
            file,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return { sources, skipped };
    },
    regenerate_permanent_slice: async ({ dry_run, preview_rules }) =>
      (
        await generate_permanent_data({
          dry_run,
          ...(preview_rules === null ? {} : { source_rules: preview_rules }),
        })
      ).changed,
    read_draft: async (draft_path) => JSON.parse(await readFile(draft_path, "utf8")),
    known_builtin_names: () => new Set(Object.keys(BUILTIN_CHECKS)),
    delete_builtin_source: async (group_id) => {
      const source_path = path.join(
        repo_root(),
        "packages",
        "core",
        "src",
        "classify_entry_points",
        "builtins",
        `check_${group_id}.ts`,
      );
      try {
        await unlink(source_path);
        return source_path;
      } catch (err) {
        if (err instanceof Error && (err as { code?: string }).code === "ENOENT") {
          return null;
        }
        throw err;
      }
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build_real_deps()
    .then((deps) => run_or_stage(process.argv.slice(2), deps))
    .then((summary) => process.stdout.write(JSON.stringify(summary, null, 2) + "\n"))
    .catch((err) => {
      process.stderr.write(
        `reconcile_registry failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}
