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
 *      `wip → permanent` flip. Guarded: a rule whose `classifier.kind` is
 *      `"none"` is rejected (core's `validate_permanent_slice` cannot load
 *      it). After the registry write, `generate_permanent_data.ts` regenerates
 *      the bundled core slice.
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
 *     [--dry-run] [--fixed] [--drift] [--id <group_id>...] [--promote]
 */

import { readFile, readdir } from "node:fs/promises";
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

import {
  SUBJECT_REGEX,
  TASK_SCOPE_REGEX,
  expand_task_scope,
} from "../../../../scripts/check-commit-message.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: reconcile_registry [--dry-run] [--fixed] [--drift] " +
  "[--id <group_id>...] [--promote]\n";

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
  /** The commit scope that matched, e.g. `198` or `190.17.12-14`. */
  matched_scope: string;
  /** The full commit subject, for the preview's audit line. */
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

export type RegistryProposal = FixedProposal | DriftProposal | PromoteProposal;

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
 * first matching subject.
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
 * on a proposal naming an absent rule (a detector/selector bug) and on
 * promoting a rule without a real classifier.
 */
export function fold_proposals(
  rules: readonly KnownIssue[],
  proposals: readonly RegistryProposal[],
): KnownIssue[] {
  const next = [...rules];
  const index_by_id = new Map(rules.map((rule, i) => [rule.group_id, i]));

  for (const proposal of proposals) {
    const i = index_by_id.get(proposal.group_id);
    if (i === undefined) {
      throw new Error(
        `proposal targets unknown rule "${proposal.group_id}" — not in the registry`,
      );
    }
    const rule = next[i];
    switch (proposal.kind) {
      case "wip_to_fixed":
        if (rule.status === "wip") next[i] = { ...rule, status: "fixed" };
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
        if (rule.classifier.kind === "none") {
          throw new Error(
            `cannot promote "${rule.group_id}": classifier.kind is "none" — ` +
              "author a predicate or builtin classifier first; core's " +
              "validate_permanent_slice rejects unclassified permanent rules",
          );
        }
        if (rule.status !== "permanent") next[i] = { ...rule, status: "permanent" };
        break;
    }
  }
  return next;
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
}

export function parse_argv(argv: string[]): CliArgs {
  const args: CliArgs = {
    dry_run: false,
    fixed: false,
    drift: false,
    ids: [],
    promote: false,
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
  /** Regenerate core's permanent slice; returns true when the slice changed (or would). */
  regenerate_permanent_slice: (dry_run: boolean) => Promise<boolean>;
}

export interface RejectedPromotion {
  group_id: string;
  reason: string;
}

export interface ReconcileSummary {
  dry_run: boolean;
  selectors: { fixed: boolean; drift: boolean; ids: string[]; promote: boolean };
  proposals: {
    wip_to_fixed: FixedProposal[];
    drift_detected: DriftProposal[];
    promote_to_permanent: PromoteProposal[];
  };
  /** `--id` values that matched no proposal (or, under `--promote`, no rule). */
  missing_ids: string[];
  /** `--promote` targets refused: no classifier, or already permanent. */
  rejected_promotions: RejectedPromotion[];
  /** Published `rule_id`s with no registry rule — review signals, never writes. */
  drift_unknown_rule_ids: string[];
  /** Published files that failed to read/parse; reported, never fatal. */
  skipped_sources: SkippedSource[];
  applied: boolean;
  permanent_slice_regenerated: boolean;
}

export async function run(
  argv: string[],
  deps: ReconcileDeps,
): Promise<ReconcileSummary> {
  const args = parse_argv(argv);
  const registry = await deps.load_registry();
  const rules_by_id = new Map(registry.map((rule) => [rule.group_id, rule]));

  let fixed_proposals: FixedProposal[] = [];
  let drift_proposals: DriftProposal[] = [];
  let promote_proposals: PromoteProposal[] = [];
  let drift_unknown_rule_ids: string[] = [];
  let skipped_sources: SkippedSource[] = [];
  const missing_ids: string[] = [];
  const rejected_promotions: RejectedPromotion[] = [];

  if (args.promote) {
    for (const id of args.ids) {
      const rule = rules_by_id.get(id);
      if (rule === undefined) {
        missing_ids.push(id);
      } else if (rule.classifier.kind === "none") {
        rejected_promotions.push({
          group_id: id,
          reason:
            'classifier.kind is "none" — author a predicate or builtin classifier before promoting',
        });
      } else if (rule.status === "permanent") {
        rejected_promotions.push({ group_id: id, reason: "already permanent" });
      } else {
        promote_proposals.push({ kind: "promote_to_permanent", group_id: id });
      }
    }
  } else {
    // No signal flags → both signals (the default preview).
    const detect_fixed = args.fixed || !args.drift;
    const detect_drift = args.drift || !args.fixed;
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

  let permanent_slice_regenerated = false;
  if (promote_proposals.length > 0) {
    // Registry first (source of truth), then regenerate from the fresh read.
    // Under --dry-run the generator only reports whether the slice would change.
    permanent_slice_regenerated = await deps.regenerate_permanent_slice(args.dry_run);
  }

  return {
    dry_run: args.dry_run,
    selectors: { fixed: args.fixed, drift: args.drift, ids: args.ids, promote: args.promote },
    proposals: {
      wip_to_fixed: fixed_proposals,
      drift_detected: drift_proposals,
      promote_to_permanent: promote_proposals,
    },
    missing_ids,
    rejected_promotions,
    drift_unknown_rule_ids,
    skipped_sources,
    applied,
    permanent_slice_regenerated,
  };
}

// ---------------------------------------------------------------------------
// Real-world deps
// ---------------------------------------------------------------------------

export async function build_real_deps(): Promise<ReconcileDeps> {
  const { generate_permanent_data } = await import("./generate_permanent_data.js");
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
    regenerate_permanent_slice: async (dry_run) =>
      (await generate_permanent_data({ dry_run })).changed,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build_real_deps()
    .then((deps) => run(process.argv.slice(2), deps))
    .then((summary) => process.stdout.write(JSON.stringify(summary, null, 2) + "\n"))
    .catch((err) => {
      process.stderr.write(
        `reconcile_registry failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}
