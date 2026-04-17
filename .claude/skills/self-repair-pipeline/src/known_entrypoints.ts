/**
 * Known Entrypoints Registry
 *
 * Persists confirmed-unreachable entries across triage runs.
 * Once an entry is classified (by LLM or framework source), it is recorded
 * and skipped in future runs.
 *
 * Registry files live in known_entrypoints/{project_name}.json (relative to skill root)
 */

import * as fs from "node:fs/promises";
import * as path from "path";
import type {
  EnrichedFunctionEntry,
  FalsePositiveEntry,
  KnownEntrypoint,
  KnownEntrypointSource,
} from "./types.js";
import { REGISTRY_DIR } from "./paths.js";

// ===== I/O =====

export function get_registry_path(project_name: string): string {
  return path.join(REGISTRY_DIR, `${project_name}.json`);
}

export async function load_known_entrypoints(
  project_name: string,
): Promise<KnownEntrypointSource[]> {
  const file_path = get_registry_path(project_name);
  try {
    const content = await fs.readFile(file_path, "utf-8");
    return JSON.parse(content) as KnownEntrypointSource[];
  } catch {
    return [];
  }
}

export async function save_known_entrypoints(
  project_name: string,
  sources: KnownEntrypointSource[],
): Promise<string> {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  const file_path = get_registry_path(project_name);
  await fs.writeFile(file_path, JSON.stringify(sources, null, 2) + "\n");
  return file_path;
}

// ===== Matching =====

export function matches_known_entrypoint(
  entry: EnrichedFunctionEntry,
  known: KnownEntrypoint,
  project_path: string,
): boolean {
  if (entry.name !== known.name) return false;
  if (known.kind && entry.kind !== known.kind) return false;
  if (!known.file_path) return true; // framework pattern: name-only match
  const relative = path.relative(project_path, entry.file_path);
  return relative === known.file_path;
}

// ===== Filtering =====

export interface KnownEntrypointMatch {
  entry: EnrichedFunctionEntry;
  source: string; // which source matched ("confirmed-unreachable", "react", etc.)
}

export interface FilterResult {
  known_true_positives: KnownEntrypointMatch[];
  remaining: EnrichedFunctionEntry[];
}

export function filter_known_entrypoints(
  entries: EnrichedFunctionEntry[],
  sources: KnownEntrypointSource[],
  project_path: string,
): FilterResult {
  const known_true_positives: KnownEntrypointMatch[] = [];
  const remaining: EnrichedFunctionEntry[] = [];

  for (const entry of entries) {
    let matched_source: string | null = null;

    for (const source of sources) {
      for (const known of source.entrypoints) {
        if (matches_known_entrypoint(entry, known, project_path)) {
          matched_source = source.source;
          break;
        }
      }
      if (matched_source) break;
    }

    if (matched_source) {
      known_true_positives.push({ entry, source: matched_source });
    } else {
      remaining.push(entry);
    }
  }

  return { known_true_positives, remaining };
}

// ===== Building sources from triage results =====

export function build_confirmed_unreachable_source(
  entries: FalsePositiveEntry[],
  project_path: string,
): KnownEntrypointSource {
  return {
    source: "confirmed-unreachable",
    description: "Functions with no real callers (Ariadne correctly identified as unreachable)",
    entrypoints: entries.map((e) => ({
      name: e.name,
      file_path: path.relative(project_path, e.file_path),
      start_line: e.start_line,
    })),
  };
}
