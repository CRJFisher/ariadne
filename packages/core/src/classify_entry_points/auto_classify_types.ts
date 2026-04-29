/**
 * Types internal to the `classify_entry_points` orchestrator.
 *
 * Kept narrow on purpose: the evaluator is pure over `EnrichedEntryPoint` +
 * a lazy file reader, so any future classifier axis introduces its own context
 * shape rather than widening this one up-front.
 */

import type { EnrichedEntryPoint, ClassifierHint } from "@ariadnejs/types";

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

export interface ClassifiedEntryPointResult {
  entry_point: EnrichedEntryPoint;
  result: AutoClassifyResult;
}

/** Reads file lines lazily. Callers cache per-file so each file is read at most once per run. */
export type FileLinesReader = (file_path: string) => readonly string[];

export interface PredicateContext {
  entry_point: EnrichedEntryPoint;
  read_file_lines: FileLinesReader;
}
