/**
 * Single chokepoint for reading a v4 `triage_results/<run-id>.json` artifact.
 *
 * The curator's three callers (`curate_all`, `finalize_run`,
 * `validate_responses`, `get_investigate_context`) all need the same shape +
 * schema guarantees: hard-reject any file whose `schema_version` does not
 * equal `TRIAGE_RESULTS_SCHEMA_VERSION`, and surface the required v4 arrays
 * (`novel_issues`, `classifier_regressions`, `confirmed_unreachable`,
 * `uncertain`) as actually-present arrays so downstream `.find()` / `.map()`
 * calls cannot blow up with a confusing `Cannot read properties of undefined`.
 *
 * The parser is shape-strict only at the top-level array boundary: deeper
 * citation / entry parsing is left to the consumer (the type cast is honest
 * because a v4 producer is the only legitimate writer of these files). This
 * mirrors `@ariadnejs/types::parse_known_issues_registry_json`'s contract.
 */

import * as fs from "node:fs/promises";

import { TRIAGE_RESULTS_SCHEMA_VERSION, type TriageResultsFile } from "./types.js";

/**
 * Parse a v4 triage results JSON string. Throws if the payload is not an
 * object, the schema_version does not match, or any required v4 top-level
 * array is missing.
 */
export function parse_v4_triage_results(
  source_label: string,
  text: string,
): TriageResultsFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${source_label}: invalid JSON — ${msg}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${source_label}: expected an object, got ${describe(parsed)}`);
  }
  const obj = parsed as Record<string, unknown>;
  const schema_version = obj.schema_version;
  if (schema_version !== TRIAGE_RESULTS_SCHEMA_VERSION) {
    throw new Error(
      `${source_label}: schema_version=${String(schema_version)} does not match ` +
        `curator-supported v${TRIAGE_RESULTS_SCHEMA_VERSION}. Re-finalize the run.`,
    );
  }
  const required_arrays: readonly (keyof TriageResultsFile)[] = [
    "novel_issues",
    "flagged_novel_verdicts",
    "classifier_regressions",
    "confirmed_unreachable",
    "uncertain",
  ];
  for (const field of required_arrays) {
    if (!Array.isArray(obj[field])) {
      throw new Error(
        `${source_label}: '${String(field)}' must be an array (got ${describe(obj[field])})`,
      );
    }
  }
  return parsed as TriageResultsFile;
}

/** Convenience wrapper: read the file from disk and parse. */
export async function read_v4_triage_results(path: string): Promise<TriageResultsFile> {
  const text = await fs.readFile(path, "utf8");
  return parse_v4_triage_results(path, text);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
