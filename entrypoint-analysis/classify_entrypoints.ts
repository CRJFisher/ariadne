/**
 * Deterministic entry point classification
 *
 * Applies ordered rules to classify enriched entry points as either
 * true positives (real entry points) or false positives (grouped by root cause),
 * without any LLM calls.
 *
 * Entries that don't match any rule are left unclassified for LLM triage.
 */

import type { EnrichedFunctionEntry } from "./types.js";

// ===== Classification Result Types =====

export interface ClassifiedEntry {
  entry: EnrichedFunctionEntry;
  group_id: string;
  root_cause: string;
  rule_id: string;
}

export interface PreClassificationResult {
  true_positives: EnrichedFunctionEntry[];
  classified_false_positives: ClassifiedEntry[];
  unclassified: EnrichedFunctionEntry[];
}

// ===== Classification Rules =====

interface ClassificationRule {
  id: string;
  /** Return a group_id + root_cause if the rule matches, or null to skip */
  classify: (entry: EnrichedFunctionEntry) => {
    group_id: string;
    root_cause: string;
    is_true_positive: boolean;
  } | null;
}

/**
 * Rule 1: No textual callers + exported → true entry point
 *
 * If grep finds no callers anywhere in the source and the function is exported,
 * it's genuinely a public API entry point (not a false positive).
 */
const rule_no_callers_exported: ClassificationRule = {
  id: "no-callers-exported",
  classify: (entry) => {
    if (
      entry.diagnostics.diagnosis === "no-textual-callers" &&
      entry.is_exported
    ) {
      return {
        group_id: "true-entry-point",
        root_cause: "Exported function with no callers in the codebase",
        is_true_positive: true,
      };
    }
    return null;
  },
};

/**
 * Rule 2: Constructors → constructor resolution bug
 *
 * Constructors are frequently missed by call graph resolution because
 * `new ClassName()` patterns require matching the constructor definition
 * through the class symbol.
 */
const rule_constructor: ClassificationRule = {
  id: "constructor",
  classify: (entry) => {
    if (entry.kind === "constructor") {
      return {
        group_id: "constructor-resolution-bug",
        root_cause:
          "Constructor calls (new ClassName()) are not resolved to the constructor definition in the call graph",
        is_true_positive: false,
      };
    }
    return null;
  },
};

/**
 * Rule 3: Protected/private methods → this-call tracking bug
 *
 * Non-public methods can only be called via `this.method()` or within the class.
 * Ariadne doesn't track `this`-dispatch, so these appear as uncalled.
 */
const rule_non_public_method: ClassificationRule = {
  id: "non-public-method",
  classify: (entry) => {
    if (
      entry.kind === "method" &&
      (entry.access_modifier === "protected" ||
        entry.access_modifier === "private")
    ) {
      return {
        group_id: "method-call-via-this-not-tracked",
        root_cause:
          `${entry.access_modifier} method called via this-dispatch which Ariadne does not track`,
        is_true_positive: false,
      };
    }
    return null;
  },
};

/**
 * Rule 4: Callback functions → callback invocation tracking bug
 *
 * Functions marked as callbacks are passed to other functions and invoked
 * indirectly. Ariadne doesn't track callback invocation chains.
 */
const rule_callback: ClassificationRule = {
  id: "callback",
  classify: (entry) => {
    if (entry.callback_context?.is_callback) {
      return {
        group_id: "callback-invocation-not-tracked",
        root_cause:
          "Callback function passed to another function; Ariadne does not track indirect callback invocations",
        is_true_positive: false,
      };
    }
    return null;
  },
};

/**
 * Ordered list of classification rules.
 * Rules are applied in order; first match wins.
 *
 * Entries with diagnosis "callers-not-in-registry" or "callers-in-registry-unresolved"
 * are intentionally NOT classified here — knowing THAT there's a bug isn't enough,
 * LLM triage is needed to identify WHAT code pattern caused the bug.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  rule_no_callers_exported,
  rule_constructor,
  rule_non_public_method,
  rule_callback,
];

// ===== Main Classification Function =====

/**
 * Classify enriched entry points using deterministic rules.
 *
 * Applies ordered rules to sort entries into three buckets:
 * - true_positives: Confirmed real entry points (no LLM needed)
 * - classified_false_positives: Known false positive patterns (no LLM needed)
 * - unclassified: Entries requiring LLM investigation
 */
export function classify_entrypoints(
  entries: EnrichedFunctionEntry[],
): PreClassificationResult {
  const true_positives: EnrichedFunctionEntry[] = [];
  const classified_false_positives: ClassifiedEntry[] = [];
  const unclassified: EnrichedFunctionEntry[] = [];

  for (const entry of entries) {
    let matched = false;

    for (const rule of CLASSIFICATION_RULES) {
      const result = rule.classify(entry);
      if (result) {
        if (result.is_true_positive) {
          true_positives.push(entry);
        } else {
          classified_false_positives.push({
            entry,
            group_id: result.group_id,
            root_cause: result.root_cause,
            rule_id: rule.id,
          });
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      unclassified.push(entry);
    }
  }

  return { true_positives, classified_false_positives, unclassified };
}
