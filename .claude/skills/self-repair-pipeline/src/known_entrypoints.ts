/**
 * Known Entrypoints Registry
 *
 * Persists confirmed true positives and dead code across triage runs.
 * Once an entry is classified (by LLM or framework source), it is recorded
 * and skipped in future runs.
 *
 * Registry files live in known_entrypoints/{project_name}.json (relative to skill root)
 */

import * as fs from "node:fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import type {
  EnrichedFunctionEntry,
  FalsePositiveEntry,
  KnownEntrypoint,
  KnownEntrypointSource,
} from "./types.js";

const this_file = fileURLToPath(import.meta.url);
const this_dir = path.dirname(this_file);
const REGISTRY_DIR = path.resolve(this_dir, "..", "known_entrypoints");

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
  source: string; // which source matched ("project", "react", etc.)
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

export function build_project_source(
  true_positives: FalsePositiveEntry[],
  project_path: string,
): KnownEntrypointSource {
  return {
    source: "project",
    description: "Confirmed entry points from triage",
    entrypoints: true_positives.map((tp) => ({
      name: tp.name,
      file_path: path.relative(project_path, tp.file_path),
      start_line: tp.start_line,
    })),
  };
}

export function build_dead_code_source(
  dead_code: FalsePositiveEntry[],
  project_path: string,
): KnownEntrypointSource {
  return {
    source: "dead-code",
    description: "Functions identified as likely dead code",
    entrypoints: dead_code.map((dc) => ({
      name: dc.name,
      file_path: path.relative(project_path, dc.file_path),
      start_line: dc.start_line,
    })),
  };
}
