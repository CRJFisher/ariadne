import type {
  CallGraph,
  SymbolId,
  CallableNode,
  Language,
  FilePath,
  TraceCallGraphOptions,
} from "@ariadnejs/types";
import { create_symbol_name } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../resolve_references/registries/definition";
import type { ResolutionRegistry } from "../resolve_references/resolve_references";
import { is_test_file } from "../project/detect_test_file";
import { is_runner_invoked_callable } from "./runner_suppression";

export type { TraceCallGraphOptions };

const ANONYMOUS_SYMBOL_NAME = create_symbol_name("<anonymous>");

function build_function_nodes(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  languages: ReadonlyMap<FilePath, Language>
): ReadonlyMap<SymbolId, CallableNode> {
  const nodes = new Map<SymbolId, CallableNode>();

  const callable_defs = definitions.get_callable_definitions();

  for (const func_def of callable_defs) {
    // Interface method signatures have no body scope: no enclosed calls and
    // never dead code, so they are not call graph nodes.
    const body_scope_id = func_def.body_scope_id;
    if (!body_scope_id) {
      continue;
    }

    const enclosed_calls = resolutions.get_calls_by_caller_scope(body_scope_id);

    // A callable with no incoming call edge is still not dead code when a
    // test/benchmark runner invokes it — because it lives in a test file, or
    // by a definition-level runner convention (Rust `#[test]`/`#[cfg(test)]`,
    // ASV benchmark methods). Marking it lets entry-point detection suppress it.
    const file_path = func_def.location.file_path;
    const language = languages.get(file_path);
    if (language === undefined) {
      throw new Error(
        `No language recorded for ${file_path} — every callable definition must come from a parsed file`
      );
    }
    const is_test =
      is_test_file(file_path, language) ||
      is_runner_invoked_callable(func_def, file_path, language);

    nodes.set(func_def.symbol_id, {
      symbol_id: func_def.symbol_id,
      name: func_def.name,
      enclosed_calls,
      location: func_def.location,
      definition: func_def,
      is_test,
    });
  }

  return nodes;
}

function detect_entry_points(
  nodes: ReadonlyMap<SymbolId, CallableNode>,
  resolutions: ResolutionRegistry,
  options?: TraceCallGraphOptions
): SymbolId[] {
  const include_tests = options?.include_tests ?? false;

  const called_symbols = resolutions.get_all_referenced_symbols();

  const entry_points: SymbolId[] = [];

  for (const [symbol_id, node] of nodes) {
    // Anonymous functions (IIFEs, callbacks, closures) are never public entry
    // points; they surface as uncalled only because the resolver does not
    // follow their indirect invocation (self-execution, `.forEach` argument).
    if (node.name === ANONYMOUS_SYMBOL_NAME) {
      continue;
    }

    if (called_symbols.has(symbol_id)) {
      continue;
    }

    if (!include_tests && node.is_test) {
      continue;
    }

    entry_points.push(symbol_id);
  }

  return entry_points;
}

/**
 * Build the call graph and detect entry points — callables with no incoming
 * call edge.
 *
 * The entry-point set is raw: framework-invoked false positives (Python
 * dunders, Flask routes, pytest fixtures) are filtered downstream by
 * `enrich_call_graph` against the permanent known-issues registry, so callers
 * choose whether to apply that classification.
 */
export function trace_call_graph(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  languages: ReadonlyMap<FilePath, Language>,
  options?: TraceCallGraphOptions
): CallGraph {
  const nodes = build_function_nodes(definitions, resolutions, languages);
  const entry_points = detect_entry_points(nodes, resolutions, options);

  return {
    nodes,
    entry_points,
    indirect_reachability: resolutions.get_indirect_reachability(),
  };
}
