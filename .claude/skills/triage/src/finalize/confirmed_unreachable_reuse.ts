/**
 * True-positive (TP) cache derivation and application.
 *
 * On a fresh run, entries that were classified `confirmed_unreachable` in a
 * **prior run at the same target commit** can be reused without re-investigation.
 * The cache is gated entirely by the run-id's `<short-commit>-` prefix: a
 * different commit means a different cache namespace, period.
 *
 * **Cache eligibility rule**: only rows where `source.kind === "llm-tp"` are
 * indexed. `registry` rows are excluded so the cache cannot outlive a rule
 * deactivation — when a rule is marked fixed or its drift is detected, its
 * entries return to the llm-triage pool. `previously-confirmed-tp` rows are
 * excluded because the published schema carries no origin chain: a cache-hit
 * entry cannot prove its verdict traces back to a real LLM investigation.
 * `derive_tp_cache` reads all runs at the current commit (newest-first) and
 * accumulates `llm-tp` entries across them, with newer runs taking precedence on
 * key collision. A run with only `previously-confirmed-tp` rows contributes nothing
 * but does not block older runs' `llm-tp` entries from being included. Corrupt or
 * legacy-schema files are skipped with a warning. Reads all runs at the commit,
 * typically one or two.
 *
 * Source of truth: `analysis_output/<project>/triage_results/<run-id>.json`
 * (kept forever; `triage_state/<project>/runs/<run-id>/` may be pruned).
 *
 * Match key within an eligible source: `(name, file_path_relative, kind, start_line)`.
 * `file_path` is already published relative to `project_path` by
 * `build_finalization_output`, so the match is portable across machines.
 */

import * as fs from "node:fs/promises";
import path from "path";

import {
  triage_results_path,
  type PublishedConfirmedUnreachable,
  type TriageResultsFile,
} from "@ariadnejs/skill-protocol";
import {
  all_finalized_runs_at_commit,
  read_triage_results,
} from "../store/triage_results_store.js";
import type {
  TpCacheEntryKey,
  TriageEntry,
} from "../triage_state_types.js";

export interface TpCacheKey {
  name: string;
  file_path_rel: string;
  kind: string;
  start_line: number;
}

export interface TpCache {
  source_run_id: string;
  /** Canonical key string → published entry. */
  entries_by_key: Map<string, PublishedConfirmedUnreachable>;
}

export interface DeriveTpCacheOpts {
  /** Bypass entirely (`--no-reuse-tp`). When true, return null. */
  no_reuse: boolean;
  /** Pin a specific source run-id (`--tp-source-run`). Must be at the current short_commit. */
  pinned_source_run_id: string | null;
}

// NUL is invalid in identifiers, file paths, and decimal integers across all
// supported languages and operating systems. Using it as the separator makes
// `cache_key_string` collision-proof against names/paths with embedded spaces.
const KEY_SEP = "\0";

/** Canonical cache-key string. Components join with NUL so no real input collides. */
export function cache_key_string(key: TpCacheKey): string {
  return `${key.name}${KEY_SEP}${key.file_path_rel}${KEY_SEP}${key.kind}${KEY_SEP}${key.start_line}`;
}

function key_for_published(entry: PublishedConfirmedUnreachable): TpCacheKey {
  return {
    name: entry.name,
    file_path_rel: entry.file_path,
    kind: entry.kind,
    start_line: entry.start_line,
  };
}

/**
 * Build a `TpCache` from a published source. Returns `null` when the source
 * has no eligible (llm-tp) entries. Schema validation (rejecting legacy formats)
 * happens upstream in `@ariadnejs/skill-protocol`'s `parse_triage_results`; by
 * the time we get here, every entry's `kind` is one of the canonical values.
 */
function build_cache(source_run_id: string, output: TriageResultsFile): TpCache | null {
  const entries_by_key = new Map<string, PublishedConfirmedUnreachable>();
  for (const fp of output.confirmed_unreachable) {
    if (fp.source.kind !== "llm-tp") continue;
    entries_by_key.set(cache_key_string(key_for_published(fp)), fp);
  }
  if (entries_by_key.size === 0) return null;
  return { source_run_id, entries_by_key };
}

/**
 * Derive a TP cache for the current run.
 *
 * - Returns `null` when caching is disabled, no source matches, or the source
 *   has no usable entries.
 * - Throws when `pinned_source_run_id` is set but does not match
 *   `current_short_commit` or its file is missing.
 *
 * `current_short_commit` is the current run's `<short-commit>` prefix
 * (e.g. `deadbee`). Pass `null` for non-git projects — caching is disabled.
 */
export async function derive_tp_cache(
  project: string,
  current_short_commit: string | null,
  opts: DeriveTpCacheOpts,
): Promise<TpCache | null> {
  if (opts.no_reuse) return null;
  if (current_short_commit === null) return null;

  if (opts.pinned_source_run_id !== null) {
    const pinned = opts.pinned_source_run_id;
    if (!pinned.startsWith(`${current_short_commit}-`)) {
      throw new Error(
        `Pinned tp_source_run_id "${pinned}" is not at the current commit "${current_short_commit}". Refusing to reuse across commits.`,
      );
    }
    const file = triage_results_path(project, pinned);
    try {
      await fs.access(file);
    } catch {
      throw new Error(`Pinned tp_source_run_id "${pinned}" has no triage_results file at ${file}.`);
    }
    const output = await read_triage_results(project, pinned);
    const cache = build_cache(pinned, output);
    if (cache === null && output.confirmed_unreachable.length > 0) {
      console.warn(
        `[TP cache] Pinned source "${pinned}" has ${output.confirmed_unreachable.length} confirmed_unreachable ` +
          "rows but none are source.kind \"llm-tp\" — no eligible rows to reuse.",
      );
    }
    return cache;
  }

  const run_ids = await all_finalized_runs_at_commit(project, current_short_commit);
  const entries_by_key = new Map<string, PublishedConfirmedUnreachable>();
  let source_run_id: string | null = null;

  for (const run_id of run_ids) {
    let output: TriageResultsFile;
    try {
      output = await read_triage_results(project, run_id);
    } catch (err) {
      console.warn(
        `[TP cache] Skipping run "${run_id}" — could not read or parse (${err instanceof Error ? err.message : String(err)}).`,
      );
      continue;
    }
    for (const fp of output.confirmed_unreachable) {
      if (fp.source.kind !== "llm-tp") continue;
      const key = cache_key_string(key_for_published(fp));
      if (!entries_by_key.has(key)) {
        entries_by_key.set(key, fp);
        source_run_id ??= run_id;
      }
    }
  }

  if (entries_by_key.size === 0 || source_run_id === null) return null;
  return { source_run_id, entries_by_key };
}

// ===== Application =====

/**
 * Mutate matching `route="llm-triage"` entries in place: flip them to
 * `route="known-unreachable"`, status "completed", and stamp a synthesized
 * `result` plus the source provenance.
 *
 * Returns the list of canonical `TpCacheEntryKey` records describing each
 * skipped entry, for inclusion on the run's manifest.
 *
 * Match scope: only entries with `entry.route === "llm-triage"`.
 * Registry-classified entries (route="known-unreachable") already have a
 * verdict and must not be overridden — newer registry information wins.
 */
export function apply_tp_cache_to_entries(
  entries: TriageEntry[],
  cache: TpCache,
  project_path: string,
): TpCacheEntryKey[] {
  const skipped: TpCacheEntryKey[] = [];
  for (const entry of entries) {
    if (entry.route !== "llm-triage") continue;
    const file_path_rel = relativize(entry.file_path, project_path);
    const k = cache_key_string({
      name: entry.name,
      file_path_rel,
      kind: entry.kind,
      start_line: entry.start_line,
    });
    if (!cache.entries_by_key.has(k)) continue;

    entry.route = "known-unreachable";
    entry.auto_classified = true;
    entry.status = "completed";
    // This becomes the published source.kind; build_cache excludes it next run — a cache hit is never itself reused.
    entry.known_source = "previously-confirmed-tp";
    entry.tp_source_run_id = cache.source_run_id;
    entry.result = null;

    skipped.push({
      name: entry.name,
      file_path: file_path_rel,
      kind: entry.kind,
      start_line: entry.start_line,
    });
  }
  return skipped;
}

/**
 * Normalize an entry's file path to the project-relative form published
 * member identities carry. State entries may hold absolute paths; published
 * `member_symbol` / TP-cache keys are always relative to `project_path`.
 */
export function relativize(file_path: string, project_path: string): string {
  if (!path.isAbsolute(file_path)) return file_path;
  return path.relative(project_path, file_path);
}
