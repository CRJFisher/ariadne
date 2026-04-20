/**
 * Types for the `auto_classify` pipeline stage.
 *
 * Kept narrow on purpose: the evaluator is pure over `EnrichedFunctionEntry` +
 * a lazy file reader, so new classifier axes (e.g. Project-backed builtins in
 * TASK-190.16.6) introduce their own context shape rather than widening this
 * one up-front.
 *
 * `ClassifierHint` is not defined here: it lives in `../triage_state_types.ts`
 * because it is part of the persisted `TriageEntry` shape, not a transient
 * pipeline-internal value. Re-exported for convenience.
 */

import type { EnrichedFunctionEntry } from "../types.js";
import type { ClassifierHint } from "../triage_state_types.js";

export type { ClassifierHint };

export interface AutoClassifyResult {
  auto_classified: boolean;
  auto_group_id: string | null;
  reasoning: string | null;
  classifier_hints: ClassifierHint[];
}

export interface AutoClassifiedEntry {
  entry: EnrichedFunctionEntry;
  result: AutoClassifyResult;
}

/** Reads file lines lazily. Callers cache per-file so each file is read at most once per run. */
export type FileLinesReader = (file_path: string) => readonly string[];

export interface PredicateContext {
  entry: EnrichedFunctionEntry;
  read_file_lines: FileLinesReader;
}
