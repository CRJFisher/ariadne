/**
 * Types for the `auto_classify` pipeline stage.
 *
 * Kept narrow on purpose: the evaluator is pure over `EnrichedFunctionEntry` +
 * a lazy file reader, so any future classifier axis introduces its own context
 * shape rather than widening this one up-front.
 *
 * `ClassifierHint` is not defined here: it lives in `../triage_state_types.ts`
 * because it is part of the persisted `TriageEntry` shape, not a transient
 * pipeline-internal value. Re-exported for convenience.
 */

import type { EnrichedFunctionEntry } from "../entry_point_types.js";
import type { ClassifierHint } from "../triage_state_types.js";

export type { ClassifierHint };

export type AutoClassifyResult =
  | {
      auto_classified: false;
      auto_group_id: null;
      reasoning: null;
      classifier_hints: ClassifierHint[];
    }
  | {
      auto_classified: true;
      auto_group_id: string;
      reasoning: string;
      classifier_hints: ClassifierHint[];
    };

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
