import type {
  FilePath,
  AnyDefinition,
  CallReference,
  ReceiverKind,
  ResolutionFailure,
} from "@ariadnejs/types";
import type { Project } from "../project/project";

/**
 * Observational facts the resolver recorded about a call site.
 *
 * Strictly factual: mirrors the resolver's internal state at `(file, line)`
 * without any classifier taxonomy. Downstream classifiers (e.g. the
 * self-repair-pipeline auto-classifier) compose these facts with other
 * signals to produce labels; no field here encodes a verdict.
 */
export interface ExplainCallSiteResult {
  /**
   * `true` iff the resolver produced a `CallReference` at this location.
   *
   * When `false`, either the line contains no call syntax, or the
   * tree-sitter `.scm` query did not capture it. Callers can disambiguate
   * by running `query_tree` against the file's parse tree.
   */
  readonly capture_fired: boolean;

  /**
   * Syntactic shape of the receiver, mirrored from
   * `CallReference.call_site_syntax.receiver_kind`. Only present for
   * method calls — function and constructor calls leave this absent.
   */
  readonly receiver_kind?: ReceiverKind;

  /**
   * Diagnostic the resolver attached when resolution produced zero
   * candidates. Absent on resolved calls.
   */
  readonly resolution_failure?: ResolutionFailure;

  /**
   * Full `AnyDefinition` for each resolved candidate, looked up from the
   * resolver's `resolutions` array. Empty when resolution failed or no
   * capture fired.
   */
  readonly candidate_definitions: readonly AnyDefinition[];

  /**
   * Files crossed by this call's resolution: each resolved candidate
   * whose defining file differs from the caller file contributes one
   * entry. Absent when the call has no cross-file resolutions.
   *
   * Single-hop only — multi-hop re-export chains are not persisted by
   * `ImportGraph`; classifiers that need chain context read
   * `resolution_failure.partial_info.import_target_file` instead.
   */
  readonly import_trace?: readonly FilePath[];
}

/**
 * Explain what the resolver observed at a given call site.
 *
 * When multiple calls share a line (e.g. `one(); two();`), pass `column` to
 * select one; otherwise the leftmost call on the line is returned. When no
 * call reference exists at the location, the result carries
 * `capture_fired: false` — this is itself a meaningful fact, not an
 * error.
 *
 * ## Known API limits (relevant to classifier callers)
 *
 * **Chained calls cannot be individually addressed by `(line, column)`.**
 * For expressions like `factory().run()`, the outer `.run()` and inner
 * `factory()` calls share an identical `(start_line, start_column)` — the
 * outer call's AST range starts at the first character of the inner call.
 * Passing that position returns the inner call; the outer call is
 * unreachable through this API. Classifiers that need the outer call in a
 * chain must enumerate `project.resolutions.get_calls_for_file(file)`
 * directly and filter by `call_type` / `call_site_syntax.receiver_kind`.
 *
 * **`ResolutionFailureReason` values surfaced in practice are a subset of
 * the full union.** Reasons produced by deep sub-stages (e.g.
 * `import_unresolved`, `reexport_chain_unresolved`, `polymorphic_no_implementations`
 * from `method_lookup.ts`) are often short-circuited by earlier stages
 * like `name_resolution` returning `name_not_in_scope` first. Classifiers
 * must pattern-match exhaustively on the full `ResolutionFailureReason`
 * union for correctness, but end-to-end tests will only exercise a
 * subset; unit tests on `resolve_method_on_type` cover the rest.
 */
export function explain_call_site(
  project: Project,
  file: FilePath,
  line: number,
  column?: number
): ExplainCallSiteResult {
  const calls = project.resolutions.get_calls_for_file(file);
  const call = find_call_at(calls, line, column);

  if (!call) {
    return {
      capture_fired: false,
      candidate_definitions: [],
    };
  }

  const candidate_definitions: AnyDefinition[] = [];
  const cross_file_targets: FilePath[] = [];
  for (const resolution of call.resolutions) {
    const def = project.definitions.get(resolution.symbol_id);
    if (!def) continue;
    candidate_definitions.push(def);
    if (def.location.file_path !== file) {
      cross_file_targets.push(def.location.file_path);
    }
  }

  const result: {
    capture_fired: boolean;
    receiver_kind?: ReceiverKind;
    resolution_failure?: ResolutionFailure;
    candidate_definitions: readonly AnyDefinition[];
    import_trace?: readonly FilePath[];
  } = {
    capture_fired: true,
    candidate_definitions,
  };

  if (call.call_site_syntax) {
    result.receiver_kind = call.call_site_syntax.receiver_kind;
  }
  if (call.resolution_failure) {
    result.resolution_failure = call.resolution_failure;
  }
  if (cross_file_targets.length > 0) {
    result.import_trace = cross_file_targets;
  }

  return result;
}

function find_call_at(
  calls: readonly CallReference[],
  line: number,
  column: number | undefined
): CallReference | undefined {
  if (column === undefined) {
    // Pick the leftmost call on the line so the result is deterministic
    // across insertion orders (e.g. chained calls `a.b().c()`).
    let leftmost: CallReference | undefined;
    for (const c of calls) {
      if (c.location.start_line !== line) continue;
      if (!leftmost || c.location.start_column < leftmost.location.start_column) {
        leftmost = c;
      }
    }
    return leftmost;
  }
  return calls.find(
    (c) =>
      c.location.start_line === line &&
      c.location.start_column === column
  );
}
