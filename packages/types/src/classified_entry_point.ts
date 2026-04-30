/**
 * Public types for entry-point classification.
 *
 * `Project.get_call_graph()` returns true positives only; `Project.get_classified_entry_points()`
 * returns the full set, each entry paired with an `EntryPointClassification`.
 *
 * Kept separate from `call_chains.ts` (which describes the call graph shape)
 * because classification is an orthogonal concern bolted on top of the graph
 * — the classifier could be replaced or removed without touching the graph
 * types.
 */

import type { IndirectReachabilityReason } from "./call_chains.js";
import type { SymbolId } from "./symbol.js";

/**
 * Options controlling the call-graph trace stage. Carried through to
 * `Project.get_call_graph()` and `Project.get_classified_entry_points()`.
 */
export interface TraceCallGraphOptions {
  /** Include test-file callables in entry-point detection. Default: false. */
  readonly include_tests?: boolean;
}

/**
 * Classification verdict for a candidate entry point. Mutually exclusive —
 * each entry point carries exactly one classification. Every non-`true_entry_point`
 * verdict carries the matched registry rule's `group_id`.
 */
export type EntryPointClassification =
  | { readonly kind: "true_entry_point" }
  | {
      readonly kind: "framework_invoked";
      /** Stable kebab-case identifier of the matched known-issues group. */
      readonly group_id: string;
      /** Human-readable framework label (e.g. "flask", "pytest", "angular"). */
      readonly framework: string;
    }
  | {
      readonly kind: "dunder_protocol";
      readonly group_id: string;
      readonly protocol: string;
    }
  | { readonly kind: "test_only"; readonly group_id: string }
  | {
      readonly kind: "indirect_only";
      readonly group_id: string;
      readonly via: IndirectReachabilityReason;
    };

/**
 * One candidate entry point, paired with its classification verdict.
 */
export interface ClassifiedEntryPoint {
  readonly symbol_id: SymbolId;
  readonly classification: EntryPointClassification;
}

/**
 * Two-tier output of `Project.get_classified_entry_points()`:
 *   - `true_entry_points` — survive classification; appear in `CallGraph.entry_points`.
 *   - `known_false_positives` — matched a permanent-registry rule and are filtered out by default.
 */
export interface ClassifiedEntryPoints {
  readonly true_entry_points: readonly ClassifiedEntryPoint[];
  readonly known_false_positives: readonly ClassifiedEntryPoint[];
}

/**
 * A sub-threshold classifier match. Predicates always score `1.0` today, so
 * hints are accumulated only when a non-binary scorer is plugged in.
 * Persisted on `TriageEntry` so the agent prompt can weigh them before the
 * LLM investigator runs.
 */
export interface ClassifierHint {
  /** Known-issue group this hint points at. */
  group_id: string;
  /** Score in [0, 1]. Predicates return 1.0; sub-threshold means `< min_confidence`. */
  confidence: number;
  reasoning: string;
}
