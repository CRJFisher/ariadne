/**
 * True-positive (TP) cache derivation and application.
 *
 * On a fresh run, entries that were classified `confirmed_unreachable` in a
 * **prior run at the same target commit** can be reused without re-investigation.
 * The cache is gated entirely by the run-id's `<short-commit>-` prefix: a
 * different commit means a different cache namespace, period.
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
  FINALIZATION_OUTPUT_SCHEMA_VERSION,
  type FinalizationOutput,
} from "./build_finalization_output.js";
import type { FalsePositiveEntry } from "./entry_point_types.js";
import {
  most_recent_finalized_triage_results,
  read_triage_results,
  triage_results_dir_for,
} from "./triage_results_store.js";
import type {
  TpCacheEntryKey,
  TriageEntry,
  TriageEntryResult,
} from "./triage_state_types.js";

export interface TpCacheKey {
  name: string;
  file_path_rel: string;
  kind: string;
  start_line: number;
}

export interface TpCache {
  source_run_id: string;
  /** Canonical key string → published entry. */
  entries_by_key: Map<string, FalsePositiveEntry>;
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

function key_for_published(entry: FalsePositiveEntry): TpCacheKey {
  return {
    name: entry.name,
    file_path_rel: entry.file_path,
    kind: entry.kind,
    start_line: entry.start_line,
  };
}

/**
 * Build a `TpCache` from a published source. Returns `null` when the source has
 * zero usable entries (e.g. a pre-v2 file whose entries lack `kind`); the
 * caller treats that as "no eligible source" rather than "matched zero entries
 * from this source", which would mislead provenance.
 */
function build_cache(source_run_id: string, output: FinalizationOutput): TpCache | null {
  const entries_by_key = new Map<string, FalsePositiveEntry>();
  let dropped_legacy = 0;
  for (const fp of output.confirmed_unreachable) {
    if (
      fp.kind !== "function" &&
      fp.kind !== "method" &&
      fp.kind !== "constructor"
    ) {
      dropped_legacy++;
      continue;
    }
    entries_by_key.set(cache_key_string(key_for_published(fp)), fp);
  }
  if (entries_by_key.size === 0) {
    if (dropped_legacy > 0) {
      process.stderr.write(
        `[tp_cache] source run ${source_run_id} is pre-schema-v${FINALIZATION_OUTPUT_SCHEMA_VERSION} ` +
          "(every entry lacks \"kind\"); skipping cache reuse. " +
          "Re-finalize the source under the new schema or run with --no-reuse-tp.\n",
      );
    }
    return null;
  }
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
    const file = path.join(triage_results_dir_for(project), `${pinned}.json`);
    try {
      await fs.access(file);
    } catch {
      throw new Error(`Pinned tp_source_run_id "${pinned}" has no triage_results file at ${file}.`);
    }
    const output = await read_triage_results(project, pinned);
    return build_cache(pinned, output);
  }

  const found = await most_recent_finalized_triage_results(project, current_short_commit);
  if (found === null) return null;
  return build_cache(found.run_id, found.output);
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

    const result: TriageEntryResult = {
      ariadne_correct: true,
      group_id: "previously-confirmed-tp",
      root_cause: `Confirmed unreachable by run ${cache.source_run_id}`,
      reasoning: "Reused TP verdict from prior run at the same commit.",
    };

    entry.route = "known-unreachable";
    entry.auto_classified = true;
    entry.status = "completed";
    entry.known_source = "previously-confirmed-tp";
    entry.tp_source_run_id = cache.source_run_id;
    entry.result = result;

    skipped.push({
      name: entry.name,
      file_path: file_path_rel,
      kind: entry.kind,
      start_line: entry.start_line,
    });
  }
  return skipped;
}

function relativize(file_path: string, project_path: string): string {
  if (!path.isAbsolute(file_path)) return file_path;
  return path.relative(project_path, file_path);
}
