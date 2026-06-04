#!/usr/bin/env node
/**
 * One-shot, human-invoked migration that empties the auto-filed pipeline tickets
 * out of the user's `backlog/tasks/` and seeds them into the plan engine's
 * task-DB (`~/.ariadne/plan/`) as its historical corpus, then deletes the
 * markdown. Git history is the archive — a deleted ticket is recoverable at the
 * pre-migration commit, so no `backlog/archive/` copy is kept.
 *
 * ## What counts as auto-filed (the mechanical selector)
 *
 * A task is auto-filed clutter iff EITHER it is a resolver-root-cause bug
 * (`false-positive-root-cause` ∈ labels OR title matches `^[bug]`) OR a
 * signal-library gap (`signal-gap` ∈ labels AND title matches `^[gap]`).
 * Everything else is KEEP. The gap rule is a conjunction on purpose: the
 * human-authored infra tasks that carry `signal-gap` but whose titles are not
 * `[gap] …` (e.g. `Signal gap: …`) are correctly kept.
 *
 * ## Why repo-root `scripts/`, not the plan skill
 *
 * This script writes the user's `backlog/` (it deletes the migrated markdown).
 * The backlog firewall (`.claude/rules/backlog-firewall.md`) forbids that from
 * pipeline code, and its AST test scans only `.claude/skills/**` and
 * `packages/**`. Living at repo-root `scripts/` keeps the script the legitimate
 * human-direct writer, outside the scanned trees. DO NOT relocate it under those
 * trees — the `fs.rm` against a `backlog/` path would then be a firewall
 * violation needing an allowlist entry.
 *
 * ## Safety
 *
 * Dry-run is the default: it classifies, prints the buckets, asserts the
 * migrate count, and mutates nothing. `--execute` is the explicit confirmation
 * gate. On execute the order is SEED then DELETE: a crash after seeding leaves
 * the markdown intact (re-run resumes idempotently); a crash mid-delete is
 * recovered with `git restore`. The seed write is byte-identical on every re-run
 * (fixed sweep id, deterministic dedup key), so re-running is safe.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 *
 * Usage:
 *   node --import tsx scripts/migrate-pipeline-tasks.ts            # dry-run
 *   node --import tsx scripts/migrate-pipeline-tasks.ts --execute  # mutate
 *   node --import tsx scripts/migrate-pipeline-tasks.ts --expect-migrate <N>
 */

import { createHash } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanTask,
  type PlanTaskId,
  type PlanTaskStatus,
} from "@ariadnejs/skill-protocol";
import { is_ariadne_fault_area, type AriadneFaultArea } from "@ariadnejs/types";

import { JsonPlanTaskRepository } from "../.claude/skills/plan/src/store/json_plan_task_repository.js";
import { backlog_tasks_dir } from "../.claude/skills/plan/src/store/paths.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

/** The auto-filed corpus is a fixed historical block: 138 `[bug]` + 96 `[gap]`. */
const EXPECTED_MIGRATE = 234;

/**
 * Fixed sweep id stamped onto every seed (NOT clock-derived). A constant makes
 * every re-seed produce byte-identical `<id>.json`, so re-running the migration
 * never dirties the task-DB.
 */
const MIGRATION_SWEEP_ID = "migrate-pipeline-tasks";

/** The agent slug recorded as the seed's author. */
const MIGRATION_STRATEGIST = "migrate-pipeline-tasks";

/**
 * The bug tickets carry a pre-taxonomy `root-cause-<category>` label whose
 * vocabulary predates {@link AriadneFaultArea}. This table routes each onto a
 * current fault area; an unmapped or absent label falls back to `other`.
 */
const BUG_ROOT_CAUSE_TO_FAULT_AREA: Record<string, AriadneFaultArea> = {
  receiver_resolution: "receiver_type_inference",
  cross_file_flow: "import_resolution",
  syntactic_extraction: "syntactic_extraction",
  import_resolution: "import_resolution",
  coverage_config: "coverage_config",
  other: "other",
};

export type TaskKind = "bug" | "gap" | "keep";

export interface ParsedBacklogTask {
  /** Frontmatter `id`, e.g. `TASK-206`; the seed's primary key. */
  id: string;
  /** Fully-joined title (folded YAML scalars collapsed to one line). */
  title: string;
  /** Frontmatter `status` verbatim (`To Do` / `In Progress` / `Done`). */
  status: string;
  labels: string[];
  /** The `## Description` body, verbatim, preserved as the seed's `body`. */
  body: string;
  /** Parsed from the bug body's `**Observed count:** N`; 0 when absent. */
  observed_count: number;
}

// ── Frontmatter + body parsing ──────────────────────────────────────────────
// Regex/line-walk parsing, matching the repo's existing backlog-frontmatter
// readers (`src/store/backlog_dedup.ts`). Every parse degrades toward empty
// defaults rather than throwing, so a malformed human task is classified KEEP,
// never silently migrated.

/** Pull the leading `---\n…\n---` block (CRLF-normalized first); `null` if absent. */
function frontmatter_block(text: string): string | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  return match === null ? null : match[1];
}

/** Unquote a YAML scalar value: double-quoted (C-escapes), single-quoted (`''`→`'`), or bare. */
function parse_scalar(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

const TOP_LEVEL_KEY = /^([A-Za-z_][\w-]*):(.*)$/;
const FOLDED_INDICATOR = /^[>|][+-]?$/;
const LIST_ITEM = /^\s+-\s+(.*)$/;

interface FrontmatterFields {
  scalars: Map<string, string>;
  lists: Map<string, string[]>;
}

/**
 * Walk the frontmatter block line by line, tracking the current top-level key,
 * so multi-line folded scalars (`title: >-`) and block lists (`labels:`) are
 * read whole. Folded continuation lines are joined with single spaces; an
 * inline `[]` or an empty block yields an empty list.
 */
function parse_frontmatter_fields(block: string): FrontmatterFields {
  const scalars = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const lines = block.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const key_match = TOP_LEVEL_KEY.exec(lines[i]);
    if (key_match === null) continue;
    const key = key_match[1];
    const rest = key_match[2].trim();

    if (FOLDED_INDICATOR.test(rest)) {
      const parts: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        parts.push(lines[++i].trim());
      }
      scalars.set(key, parts.join(" "));
      continue;
    }
    if (rest === "" || rest === "[]") {
      const items: string[] = [];
      while (i + 1 < lines.length) {
        const item_match = LIST_ITEM.exec(lines[i + 1]);
        if (item_match === null) break;
        items.push(parse_scalar(item_match[1].trim()));
        i++;
      }
      lists.set(key, items);
      continue;
    }
    scalars.set(key, parse_scalar(rest));
  }
  return { scalars, lists };
}

const SECTION_BODY =
  /<!-- SECTION:DESCRIPTION:BEGIN -->\n([\s\S]*?)\n<!-- SECTION:DESCRIPTION:END -->/;
const DESCRIPTION_HEADING = /^## Description\s*$/m;
const NEXT_HEADING = /^## /m;
const OBSERVED_COUNT = /\*\*Observed count:\*\*\s*(\d+)/;

/**
 * Extract the ticket's Description body — the `SECTION:DESCRIPTION` region when
 * present (the structured backlog shape), else the `## Description` section up
 * to the next `##` heading, else empty. A trailing `## Resolution` block after
 * the section markers is excluded.
 */
function extract_description_body(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const section = SECTION_BODY.exec(normalized);
  if (section !== null) return section[1].trim();
  const heading = DESCRIPTION_HEADING.exec(normalized);
  if (heading === null) return "";
  const after = normalized.slice(heading.index + heading[0].length);
  const next = NEXT_HEADING.exec(after);
  return (next === null ? after : after.slice(0, next.index)).trim();
}

export function parse_backlog_task(text: string): ParsedBacklogTask {
  const block = frontmatter_block(text);
  if (block === null) {
    return { id: "", title: "", status: "", labels: [], body: "", observed_count: 0 };
  }
  const { scalars, lists } = parse_frontmatter_fields(block);
  const body = extract_description_body(text);
  const count_match = OBSERVED_COUNT.exec(body);
  return {
    id: scalars.get("id") ?? "",
    title: scalars.get("title") ?? "",
    status: scalars.get("status") ?? "",
    labels: lists.get("labels") ?? [],
    body,
    observed_count: count_match === null ? 0 : Number.parseInt(count_match[1], 10),
  };
}

// ── Classification + mapping ────────────────────────────────────────────────

const BUG_TITLE = /^\[bug\]/;
const GAP_TITLE = /^\[gap\]/;

/** Apply the mechanical selector to one parsed task. */
export function classify(parsed: ParsedBacklogTask): TaskKind {
  const is_bug =
    parsed.labels.includes("false-positive-root-cause") || BUG_TITLE.test(parsed.title);
  if (is_bug) return "bug";
  const is_gap = parsed.labels.includes("signal-gap") && GAP_TITLE.test(parsed.title);
  if (is_gap) return "gap";
  return "keep";
}

/**
 * Map a backlog status to a TERMINAL plan-task status. Seeds must be terminal so
 * the engine's reconciler — which manages only the live `proposed`/`accepted`
 * set — never adopts them as orphans (their empty `projects[]` would make them
 * un-retireable). A `Done` ticket is genuinely `resolved`; an open ticket
 * becomes `abandoned` (inert history). If the same false-positive recurs, triage
 * mints a fresh live `proposed` task with real evidence.
 */
export function map_status(backlog_status: string): PlanTaskStatus {
  switch (backlog_status) {
    case "Done":
      return "resolved";
    case "To Do":
    case "In Progress":
      return "abandoned";
    default:
      throw new Error(`unrecognized backlog status: ${JSON.stringify(backlog_status)}`);
  }
}

/** Bugs route by their `root-cause-*` label; gaps and unmapped labels fall to `other`. */
export function map_fault_area(kind: TaskKind, labels: string[]): AriadneFaultArea {
  if (kind === "gap") return "other";
  const root_cause = labels.find((l) => l.startsWith("root-cause-"));
  if (root_cause === undefined) return "other";
  return BUG_ROOT_CAUSE_TO_FAULT_AREA[root_cause.slice("root-cause-".length)] ?? "other";
}

/** Per-id seed dedup key. Distinct from the engine recipe (which hashes evidence locations a seed lacks). */
export function seed_dedup_key(id: string): string {
  return createHash("sha256").update(`seed:${id}`, "utf8").digest("hex");
}

/**
 * Map one classified ticket onto a complete {@link PlanTask} seed. The whole
 * record is total; provenance is fixed (no clock) so re-runs are byte-identical.
 * The `id` cast is the one audited branding site in this one-shot tool —
 * the source-of-truth id is the frontmatter `id`, not the filename.
 */
export function seed_from_backlog_task(parsed: ParsedBacklogTask, kind: TaskKind): PlanTask {
  const fault_area = map_fault_area(kind, parsed.labels);
  if (!is_ariadne_fault_area(fault_area)) {
    throw new Error(`computed non-area fault_area ${JSON.stringify(fault_area)} for ${parsed.id}`);
  }
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: parsed.id as PlanTaskId,
    tier: "localized",
    parent_id: null,
    child_ids: [],
    title: parsed.title,
    body: parsed.body,
    fault_area,
    evidence: [],
    observed_count: kind === "bug" ? parsed.observed_count : 0,
    projects: [],
    source_runs: [],
    status: map_status(parsed.status),
    superseded_by: null,
    exported_backlog_task: null,
    dedup_key: seed_dedup_key(parsed.id),
    created_in_sweep: MIGRATION_SWEEP_ID,
    updated_in_sweep: MIGRATION_SWEEP_ID,
    strategist: MIGRATION_STRATEGIST,
    is_classifier_work: kind === "gap",
  };
}

// ── Orchestration ───────────────────────────────────────────────────────────

interface CliArgs {
  execute: boolean;
  expect_migrate: number;
}

function parse_argv(argv: string[]): CliArgs {
  let execute = false;
  let expect_migrate = EXPECTED_MIGRATE;
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--execute":
        execute = true;
        break;
      case "--expect-migrate": {
        const value = Number.parseInt(argv[++i] ?? "", 10);
        if (!Number.isInteger(value) || value < 0) {
          throw new Error("--expect-migrate expects a non-negative integer");
        }
        expect_migrate = value;
        break;
      }
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return { execute, expect_migrate };
}

const USAGE =
  "Usage: migrate-pipeline-tasks [--execute] [--expect-migrate <N>]\n" +
  "  (default)          dry-run: classify, print buckets, assert count, mutate nothing\n" +
  "  --execute          seed the task-DB then delete the migrated markdown\n" +
  "  --expect-migrate N override the asserted migrate count (default 234)\n";

interface ClassifiedTask {
  file: string;
  parsed: ParsedBacklogTask;
  kind: TaskKind;
}

export interface MigrationSummary {
  executed: boolean;
  counts: { bug: number; gap: number; keep: number; migrate: number; expect_migrate: number };
  /** Informational only — never asserted; the user's backlog grows independently. */
  keep_count: number;
  strays_removed: number;
  seeded_ids: string[];
  deleted_files: string[];
  recovery: { undo_seeds: string; restore_precommit: string; restore_postcommit: string };
}

export async function run(argv: string[]): Promise<MigrationSummary> {
  const { execute, expect_migrate } = parse_argv(argv);
  const tasks_dir = backlog_tasks_dir();

  const entries = await readdir(tasks_dir);
  const md_files = entries.filter((f) => f.endsWith(".md"));
  const stray_files = entries.filter((f) => f.endsWith(".md.tmp"));

  const classified: ClassifiedTask[] = [];
  for (const file of md_files) {
    const text = await readFile(path.join(tasks_dir, file), "utf8");
    const parsed = parse_backlog_task(text);
    classified.push({ file, parsed, kind: classify(parsed) });
  }

  const bug = classified.filter((c) => c.kind === "bug");
  const gap = classified.filter((c) => c.kind === "gap");
  const keep = classified.filter((c) => c.kind === "keep");
  const migrate = [...bug, ...gap];

  if (migrate.length !== expect_migrate) {
    throw new Error(
      `migrate count ${migrate.length} !== expected ${expect_migrate} ` +
        `(bug=${bug.length}, gap=${gap.length}, keep=${keep.length}). ` +
        "No mutation performed. Re-check the selector or pass --expect-migrate.",
    );
  }

  const seeds = migrate.map((c) => seed_from_backlog_task(c.parsed, c.kind));
  const seeded_ids = seeds.map((s) => s.id);

  let strays_removed = 0;
  const deleted_files: string[] = [];
  if (execute) {
    const repo = new JsonPlanTaskRepository();
    await repo.put_many(seeds);
    // DELETE only after the seeds are durably written: a crash here leaves the
    // markdown intact for an idempotent re-run.
    for (const c of migrate) {
      await rm(path.join(tasks_dir, c.file));
      deleted_files.push(c.file);
    }
    for (const stray of stray_files) {
      await rm(path.join(tasks_dir, stray));
      strays_removed++;
    }
  } else {
    strays_removed = stray_files.length;
  }

  return {
    executed: execute,
    counts: {
      bug: bug.length,
      gap: gap.length,
      keep: keep.length,
      migrate: migrate.length,
      expect_migrate,
    },
    keep_count: keep.length,
    strays_removed,
    seeded_ids,
    deleted_files,
    recovery: {
      undo_seeds:
        "for id in " + seeded_ids.join(" ") + "; do rm -f \"$HOME/.ariadne/plan/tasks/$id.json\"; done",
      restore_precommit: "git restore --source=HEAD -- backlog/tasks/",
      restore_postcommit: "git revert <migration-commit-sha>",
    },
  };
}

function format_summary(summary: MigrationSummary): string {
  const { counts } = summary;
  const lines = [
    summary.executed ? "MIGRATION EXECUTED" : "DRY-RUN (no mutation)",
    `classify: ${counts.bug} [bug] · ${counts.gap} [gap] · ${counts.keep} keep`,
    `assert:   migrate == ${counts.expect_migrate} → ${counts.migrate} OK`,
    `keep:     ${summary.keep_count} (informational; not asserted)`,
    `strays:   ${summary.strays_removed} .md.tmp ${summary.executed ? "removed" : "to remove"}`,
  ];
  if (summary.executed) {
    lines.push(
      `seeded:   ${summary.seeded_ids.length} task-DB rows`,
      `deleted:  ${summary.deleted_files.length} markdown files`,
      "",
      "reverse (task-DB seeds): " + summary.recovery.undo_seeds,
      "reverse (markdown, pre-commit):  " + summary.recovery.restore_precommit,
      "reverse (markdown, post-commit): " + summary.recovery.restore_postcommit,
    );
  } else {
    lines.push("", "run with --execute to seed the task-DB and delete the markdown");
  }
  return lines.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((summary) => process.stdout.write(format_summary(summary)))
    .catch((err) => {
      process.stderr.write(
        `migrate-pipeline-tasks failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}
