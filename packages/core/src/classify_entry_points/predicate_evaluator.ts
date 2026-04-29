/**
 * Evaluator for the known-issues predicate DSL.
 *
 * Pure over an `EnrichedEntryPoint` and a lazy per-file line reader. Callers
 * (see `classify_entry_points.ts`) pre-cache the reader so each source file
 * is read at most once per run.
 *
 * Design notes:
 * - The switch over `PredicateExpr.op` is exhaustive; TypeScript narrows the
 *   default branch to `never` at the end, and any unhandled discriminant is a
 *   compile error. Registry-side validation rejects unknown operators at load
 *   time (see the skill's `known_issues_registry.ts`; the bundled permanent
 *   slice is pre-validated).
 * - Regex patterns are pre-compiled by `registry_loader.ts` and attached as
 *   `compiled_pattern: RegExp` on the node; we prefer it here and fall back to
 *   `new RegExp(pattern)` only to keep unit tests tolerant of hand-built nodes.
 */

import type {
  DefinitionFeatureName,
  DefinitionFeatures,
  SyntacticFeatures,
  SyntacticFeatureName,
  PredicateExpr,
} from "@ariadnejs/types";
import { detect_language } from "./extract_entry_point_diagnostics";
import type { PredicateContext } from "./auto_classify_types";

export function evaluate_predicate(expr: PredicateExpr, ctx: PredicateContext): boolean {
  switch (expr.op) {
    case "all":
      return expr.of.every((child) => evaluate_predicate(child, ctx));
    case "any":
      return expr.of.some((child) => evaluate_predicate(child, ctx));
    case "not":
      return !evaluate_predicate(expr.of, ctx);

    case "diagnosis_eq":
      return ctx.entry_point.diagnostics.diagnosis === expr.value;

    case "language_eq":
      return detect_language(ctx.entry_point.file_path) === expr.value;

    case "decorator_matches": {
      const lines = ctx.read_file_lines(ctx.entry_point.file_path);
      const block = extract_decorator_block(lines, ctx.entry_point.start_line);
      return compiled_regex_for(expr).test(block);
    }

    case "grep_line_regex": {
      const re = compiled_regex_for(expr);
      return ctx.entry_point.diagnostics.grep_call_sites.some((h) => re.test(h.content));
    }

    case "has_capture_at_grep_hit":
      return ctx.entry_point.diagnostics.grep_call_sites.some((h) =>
        h.captures.includes(expr.capture_name),
      );

    case "missing_capture_at_grep_hit":
      // "Some grep hit failed to fire the expected capture" — matches the
      // intent of entries like `constructor-new-expression`, where grep sees
      // `new Name(` but the `.scm` query did not fire `@reference.constructor`.
      return ctx.entry_point.diagnostics.grep_call_sites.some(
        (h) => !h.captures.includes(expr.capture_name),
      );

    case "resolution_failure_reason_eq":
      return ctx.entry_point.diagnostics.ariadne_call_refs.some(
        (r) => r.resolution_failure !== null && r.resolution_failure.reason === expr.value,
      );

    case "receiver_kind_eq":
      return ctx.entry_point.diagnostics.ariadne_call_refs.some(
        (r) => r.receiver_kind === expr.value,
      );

    case "syntactic_feature_eq":
      return ctx.entry_point.diagnostics.ariadne_call_refs.some(
        (r) => syntactic_feature_value(r.syntactic_features, expr.name) === expr.value,
      );

    case "grep_hits_all_intra_file": {
      const hits = ctx.entry_point.diagnostics.grep_call_sites;
      if (hits.length === 0) return false === expr.value;
      const all_intra = hits.every((h) => h.file_path === ctx.entry_point.file_path);
      return all_intra === expr.value;
    }

    case "grep_hit_neighbourhood_matches": {
      const re = compiled_regex_for(expr);
      const window = expr.window;
      return ctx.entry_point.diagnostics.grep_call_sites.some((h) => {
        const lines = ctx.read_file_lines(h.file_path);
        const start = Math.max(0, h.line - 1 - window);
        const end = h.line - 1; // exclusive of the hit line itself
        for (let i = start; i < end; i++) {
          if (re.test(lines[i] ?? "")) return true;
        }
        return false;
      });
    }

    case "definition_feature_eq":
      return (
        definition_feature_value(ctx.entry_point.definition_features, expr.name) === expr.value
      );

    case "accessor_kind_eq": {
      const actual = ctx.entry_point.definition_features.accessor_kind ?? "none";
      return actual === expr.value;
    }

    case "has_unindexed_test_caller": {
      const hits = ctx.entry_point.diagnostics.grep_call_sites_unindexed_tests;
      const has = hits.length > 0;
      return has === expr.value;
    }
  }
  // Unreachable: all discriminants above handled. If registry loading lets a
  // bad operator through, we throw rather than silently return false.
  const unreachable: never = expr;
  throw new Error(`Unknown predicate operator: ${JSON.stringify(unreachable)}`);
}

function definition_feature_value(
  features: DefinitionFeatures,
  name: DefinitionFeatureName,
): boolean {
  switch (name) {
    case "definition_is_object_literal_method":
      return features.definition_is_object_literal_method;
  }
}

function compiled_regex_for(
  expr: { pattern: string; compiled_pattern?: RegExp },
): RegExp {
  return expr.compiled_pattern ?? new RegExp(expr.pattern);
}

function syntactic_feature_value(
  features: SyntacticFeatures,
  name: SyntacticFeatureName,
): boolean {
  switch (name) {
    case "is_new_expression":
      return features.is_new_expression;
    case "is_super_call":
      return features.is_super_call;
    case "is_optional_chain":
      return features.is_optional_chain;
    case "is_awaited":
      return features.is_awaited;
    case "is_callback_arg":
      return features.is_callback_arg;
    case "is_inside_try":
      return features.is_inside_try;
    case "is_dynamic_dispatch":
      return features.is_dynamic_dispatch;
  }
}

/**
 * Extract the lines immediately preceding a function's start line that look
 * like language-level decorators/attributes. Best-effort and language-loose —
 * the regex catches Python `@decorator`, TypeScript `@Component(...)`, and
 * Rust `#[attribute]` / `#![attribute]`. Stops at the first non-decorator
 * line walking upward, which bounds the work to the immediate decorator run.
 */
function extract_decorator_block(
  lines: readonly string[],
  start_line_1_based: number,
): string {
  const collected: string[] = [];
  for (let i = start_line_1_based - 2; i >= 0; i--) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) continue; // allow blank lines between decorators
    if (trimmed.startsWith("@") || trimmed.startsWith("#[") || trimmed.startsWith("#![")) {
      collected.unshift(line);
      continue;
    }
    break;
  }
  return collected.join("\n");
}
