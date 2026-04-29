/**
 * Orchestrator for the auto-classify pipeline stage.
 *
 * For every `EnrichedEntryPoint`, walk the known-issues registry in priority
 * order and evaluate each entry's classifier:
 *   - `classifier.kind === "none"`      → skip (known issue, no automated detection)
 *   - `classifier.kind === "predicate"` → evaluate via `predicate_evaluator`.
 *   - `classifier.kind === "builtin"`   → look up `function_name` in the
 *     generated `builtins/index.ts` barrel and invoke it. A missing entry is a
 *     stale-barrel error — it means the registry references a builtin that the
 *     barrel was never regenerated for. Throw `MissingBuiltinError` so the
 *     pipeline stops loudly instead of silently dropping the classifier.
 *
 * First auto-classification short-circuits the walk for that entry; sub-threshold
 * hits accumulate so the agent prompt can weigh them before starting investigation.
 *
 * Classifiers are binary: they score `1.0` on match, and non-matching entries are
 * filtered out before scoring — with `min_confidence ∈ [0, 1]` enforced at registry
 * load, matches always satisfy the threshold today. The sub-threshold branch
 * exists so non-binary scorers could be introduced without reshaping callers.
 */

import type { EnrichedEntryPoint } from "../entry_point_types.js";
import type { KnownIssuesRegistry } from "../known_issues_types.js";
import { BUILTIN_CHECKS, type BuiltinCheckFn } from "./builtins/index.js";
import { evaluate_predicate } from "./predicate_evaluator.js";
import type {
  ClassifiedEntryPointResult,
  AutoClassifyResult,
  ClassifierHint,
  FileLinesReader,
  PredicateContext,
} from "./types.js";

export interface AutoClassifyOptions {
  /**
   * Override the default BUILTIN_CHECKS registry. Used by tests to inject
   * fake builtins without touching the generated barrel. Production callers
   * omit this and let the orchestrator import the real barrel.
   */
  builtin_checks?: Readonly<Record<string, BuiltinCheckFn>>;
}

export class MissingBuiltinError extends Error {
  constructor(
    public readonly group_id: string,
    public readonly function_name: string,
  ) {
    super(
      `Registry entry "${group_id}" references builtin classifier "${function_name}" ` +
        "but no implementation is registered in BUILTIN_CHECKS. The generated " +
        "barrel `auto_classify/builtins/index.ts` is stale — re-run the " +
        "triage-curator finalize step to regenerate it.",
    );
    this.name = "MissingBuiltinError";
  }
}

export function auto_classify(
  entry_points: readonly EnrichedEntryPoint[],
  registry: KnownIssuesRegistry,
  read_file_lines: FileLinesReader,
  options: AutoClassifyOptions = {},
): ClassifiedEntryPointResult[] {
  const builtin_checks = options.builtin_checks ?? BUILTIN_CHECKS;
  return entry_points.map((entry_point) =>
    classify_one(entry_point, registry, read_file_lines, builtin_checks),
  );
}

function classify_one(
  entry_point: EnrichedEntryPoint,
  registry: KnownIssuesRegistry,
  read_file_lines: FileLinesReader,
  builtin_checks: Readonly<Record<string, BuiltinCheckFn>>,
): ClassifiedEntryPointResult {
  const ctx: PredicateContext = { entry_point, read_file_lines };
  const hints: ClassifierHint[] = [];

  for (const issue of registry) {
    const spec = issue.classifier;
    let reasoning: string;
    let min_confidence: number;
    if (spec.kind === "predicate") {
      if (!evaluate_predicate(spec.expression, ctx)) continue;
      reasoning = `Matched predicate classifier for ${issue.group_id}`;
      min_confidence = spec.min_confidence;
    } else if (spec.kind === "builtin") {
      const check = builtin_checks[spec.function_name];
      if (check === undefined) {
        throw new MissingBuiltinError(issue.group_id, spec.function_name);
      }
      if (!check(entry_point, read_file_lines)) continue;
      reasoning = `Matched builtin classifier ${spec.function_name} for ${issue.group_id}`;
      min_confidence = spec.min_confidence;
    } else {
      continue;
    }

    const confidence = 1.0;
    if (confidence >= min_confidence) {
      const result: AutoClassifyResult = {
        auto_classified: true,
        auto_group_id: issue.group_id,
        reasoning,
        classifier_hints: hints,
      };
      return { entry_point, result };
    }
    hints.push({ group_id: issue.group_id, confidence, reasoning });
  }

  const result: AutoClassifyResult = {
    auto_classified: false,
    auto_group_id: null,
    reasoning: null,
    classifier_hints: hints,
  };
  return { entry_point, result };
}
