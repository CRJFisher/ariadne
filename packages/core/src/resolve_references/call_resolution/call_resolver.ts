/**
 * Resolves call references to their target symbols using type information and
 * name resolutions.
 *
 * `resolve_calls` carries a type-registry side effect for Python namespace
 * constructors: when a method call with `potential_construct_target` resolves
 * to a class (e.g. `user = models.User(name)`), the variable's type is
 * registered in the TypeRegistry so subsequent method calls on it can resolve.
 */

import type {
  SymbolId,
  FilePath,
  CallReference,
  CallSiteSyntax,
  SymbolReference,
  ScopeId,
  SymbolName,
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  ConstructorCallReference,
  Language,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { location_key, is_err, is_ok } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";
import type { ScopeRegistry } from "../registries/scope";
import type { ReferenceRegistry } from "../registries/reference";
import type { ExportRegistry } from "../registries/export";
import type { ImportGraph } from "../import_resolution/import_graph";
import type { FileSystemFolder } from "../file_folders";
import type { CallResolutionResult } from "../resolution_state";
import type { ResolutionRegistry } from "../resolution_registry";
import { detect_indirect_reachability } from "../indirect_reachability";
import { resolve_callable_values } from "./callable_value";
import { resolve_method_call } from "./method_call";
import { create_method_call_reference } from "../../index_single_file/references/factories";
import { resolve_constructor_call, include_constructors_for_class_symbols } from "./constructor";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_function_call } from "./function_call";

type CallSymbolReference =
  | SelfReferenceCall
  | MethodCallReference
  | FunctionCallReference
  | ConstructorCallReference;

export interface CallResolutionContext {
  readonly references: ReferenceRegistry;
  readonly scopes: ScopeRegistry;
  readonly types: TypeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly imports: ImportGraph;
  readonly resolutions: ResolutionRegistry;
  readonly exports: ExportRegistry;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly root_folder: FileSystemFolder;
}

/**
 * Resolve every call reference for a set of files, returning resolved call
 * references grouped by file and by caller scope. Pure: computes new call
 * resolutions from scratch.
 */
export function resolve_calls_for_files(
  file_ids: Set<FilePath>,
  context: CallResolutionContext
): CallResolutionResult {
  if (file_ids.size === 0) {
    return {
      resolved_calls_by_file: new Map(),
      calls_by_caller_scope: new Map(),
      indirect_reachability: new Map(),
    };
  }

  const file_references = new Map<FilePath, readonly SymbolReference[]>();
  for (const file_id of file_ids) {
    const refs = context.references.get_file_references(file_id);
    if (refs.length > 0) {
      file_references.set(file_id, refs);
    }
  }

  const resolved_calls = resolve_calls(
    file_references,
    context
  );

  const callback_invocations = resolve_callback_invocations(
    file_ids,
    context.references,
    context.definitions
  );

  const all_calls = [...resolved_calls, ...callback_invocations];

  const calls_by_file = new Map<FilePath, CallReference[]>();
  const calls_by_caller = new Map<ScopeId, CallReference[]>();

  for (const call of all_calls) {
    const caller_scope_id = context.scopes.find_enclosing_function_scope(call.scope_id);

    const enriched_call: CallReference = {
      ...call,
      caller_scope_id,
    } as CallReference;

    const file_path = enriched_call.location.file_path;
    const existing_file = calls_by_file.get(file_path);
    if (existing_file) {
      existing_file.push(enriched_call);
    } else {
      calls_by_file.set(file_path, [enriched_call]);
    }

    // Keyed by caller scope for O(1) lookup during call-graph construction.
    if (caller_scope_id) {
      const existing_caller = calls_by_caller.get(caller_scope_id);
      if (existing_caller) {
        existing_caller.push(enriched_call);
      } else {
        calls_by_caller.set(caller_scope_id, [enriched_call]);
      }
    }
  }

  // Every requested file gets an entry, empty or not, so consumers can
  // distinguish "resolved, no calls" from "not processed".
  const resolved_calls_by_file = new Map<FilePath, readonly CallReference[]>();
  for (const file_id of file_ids) {
    resolved_calls_by_file.set(file_id, calls_by_file.get(file_id) ?? []);
  }

  const indirect_reachability = detect_indirect_reachability(
    file_references,
    context.definitions,
    (scope_id, name) => context.resolutions.resolve(scope_id as ScopeId, name)
  );
  for (const [symbol_id, entry] of resolve_callable_values(
    file_references,
    context
  )) {
    if (!indirect_reachability.has(symbol_id)) {
      indirect_reachability.set(symbol_id, entry);
    }
  }

  return {
    resolved_calls_by_file,
    calls_by_caller_scope: calls_by_caller,
    indirect_reachability,
  };
}

/**
 * Resolve all call references, dispatching on the discriminated `ref.kind`.
 */
function resolve_calls(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  context: CallResolutionContext
): CallReference[] {
  const resolved_calls: CallReference[] = [];

  for (const references of file_references.values()) {
    for (const ref of references) {
      let dispatch_result: Result<SymbolId[], ResolutionFailure>;

      switch (ref.kind) {
        case "self_reference_call":
        case "method_call": {
          // Self-reference calls (this/self/super.method()) and receiver method
          // calls (obj.method()) share one resolution path.
          const method_result = resolve_method_call(
            ref,
            context.scopes,
            context.definitions,
            context.types,
            context.resolutions,
            context.imports,
            context.exports,
            context.languages,
            context.root_folder
          );

          // If standard resolution failed, try collection dispatch resolution.
          // Prefer the original method-call failure as the recorded reason —
          // the call was syntactically a method call; collection dispatch is
          // a synthetic fallback whose failure isn't user-meaningful here.
          if (is_ok(method_result) && method_result.value.length > 0) {
            dispatch_result = method_result;
          } else {
            const dispatch_fallback = resolve_collection_dispatch(
              ref,
              context.definitions,
              context.resolutions
            );
            if (is_ok(dispatch_fallback) && dispatch_fallback.value.length > 0) {
              dispatch_result = dispatch_fallback;
            } else {
              dispatch_result = method_result;
            }
          }
          break;
        }

        case "function_call":
          dispatch_result = resolve_function_call(ref, context, context.resolutions);
          break;

        case "constructor_call":
          dispatch_result = resolve_constructor_call(
            ref,
            context.definitions,
            context.scopes,
            context.resolutions,
            context.exports,
            context.languages,
            context.root_folder,
            (import_id) => context.imports.get_resolved_import_path(import_id)
          );
          break;

        case "property_access": {
          // A bare property read (`obj.value`) invokes a getter accessor
          // (`get value()`), which is otherwise unreachable because no
          // call_expression fires on the read. Resolve it through the method-call
          // machinery via a synthetic method_call ref, and keep an edge only for
          // members whose definition is a getter: a data-field read resolves to a
          // property (kind !== "method"), and a plain method read resolves to a
          // non-accessor method — both are filtered out, so only getter reads
          // become edges. (Polymorphic dispatch can still surface a subclass's
          // getter override of the read name; that mirrors ordinary method-call
          // over-approximation and is intended.)
          //
          // This branch builds its own edge and `continue`s rather than falling
          // through to the shared tail because `property_access` is not a call
          // kind: `build_call_reference` is exhaustive over call kinds and would
          // reject the raw ref, hence the synthetic method_call. The tail's
          // constructor-inclusion and late-binding enrichments don't apply to
          // getter reads.
          const getter_call = create_method_call_reference(
            ref.name,
            ref.location,
            ref.scope_id,
            ref.receiver_location,
            ref.property_chain,
            ref.is_optional_chain
          );
          const getter_result = resolve_method_call(
            getter_call,
            context.scopes,
            context.definitions,
            context.types,
            context.resolutions,
            context.imports,
            context.exports,
            context.languages,
            context.root_folder
          );
          const getters = (
            is_ok(getter_result) ? getter_result.value : []
          ).filter((sym) => {
            const def = context.definitions.get(sym);
            return def?.kind === "method" && def.accessor_kind === "getter";
          });
          if (getters.length > 0) {
            resolved_calls.push(
              build_call_reference(getter_call, getters, context.definitions)
            );
          }
          continue;
        }

        // A callable value never becomes a CallReference — it resolves to an
        // indirect-reachability entry in resolve_callable_values, keeping
        // build_call_reference exhaustive over call kinds only.
        case "callable_value":
        case "variable_reference":
        case "type_reference":
        case "assignment":
          continue;

        default: {
          const _exhaustive: never = ref;
          throw new Error(
            `Unhandled reference kind: ${(_exhaustive as { kind: string }).kind}`
          );
        }
      }

      let resolved_symbols: SymbolId[] = is_ok(dispatch_result)
        ? [...dispatch_result.value]
        : [];

      resolved_symbols = include_constructors_for_class_symbols(
        resolved_symbols,
        context.definitions,
        context.resolutions
      );

      // Python namespace constructor (`user = models.User(name)`): once the
      // call resolves to a class, bind the assigned variable's type so later
      // method calls on it can resolve.
      if (ref.kind === "method_call" && ref.potential_construct_target) {
        const resolved_class = resolved_symbols.find(
          (s) => context.definitions.get(s)?.kind === "class"
        );
        if (resolved_class) {
          const assigned_variable = context.definitions.get_symbol_at_location(
            location_key(ref.potential_construct_target)
          );
          if (assigned_variable) {
            context.types.register_late_binding(
              assigned_variable,
              resolved_class,
              ref.location.file_path
            );
          }
        }
      }

      // Emit a CallReference even on failure so downstream consumers can read
      // `resolution_failure`.
      const failure: ResolutionFailure | undefined =
        resolved_symbols.length === 0 && is_err(dispatch_result)
          ? dispatch_result.error
          : undefined;

      const call_ref = build_call_reference(
        ref as CallSymbolReference,
        resolved_symbols,
        context.definitions,
        failure
      );
      resolved_calls.push(call_ref);
    }
  }

  return resolved_calls;
}

/**
 * Build a CallReference from resolved symbols.
 *
 * When `resolved_symbols` is empty and `failure` is provided, the returned
 * `CallReference` carries `resolution_failure` and an empty `resolutions` array.
 * Consumers that only care about resolved edges should gate on
 * `resolutions.length > 0`.
 */
function build_call_reference(
  ref: CallSymbolReference,
  resolved_symbols: SymbolId[],
  definitions: DefinitionRegistry,
  failure?: ResolutionFailure
): CallReference {
  // On failure there is no resolved symbol to inspect, so fall back to the
  // syntactic kind from `ref`.
  const syntax_fallback: "function" | "method" | "constructor" =
    ref.kind === "function_call"
      ? "function"
      : ref.kind === "constructor_call"
      ? "constructor"
      : "method";

  const call_type: "function" | "method" | "constructor" =
    resolved_symbols.length > 0
      ? infer_call_type_from_resolution(
          resolved_symbols[0],
          definitions,
          syntax_fallback
        )
      : syntax_fallback;

  // Multiple method resolutions indicate interface + implementations (polymorphic dispatch)
  const is_interface_impl =
    call_type === "method" && resolved_symbols.length > 1;

  const base = {
    location: ref.location,
    name: ref.name,
    scope_id: ref.scope_id,
    call_type,
    resolutions: resolved_symbols.map((symbol_id) => ({
      symbol_id,
      confidence: "certain" as const,
      reason: is_interface_impl
        ? ({
            type: "interface_implementation" as const,
            interface_id: "unknown" as SymbolId,
          } as const)
        : ({ type: "direct" as const } as const),
    })),
  };

  // MethodCallReference carries the indexer-computed call_site_syntax;
  // SelfReferenceCall gets a synthesized { receiver_kind: "self_keyword" } so
  // downstream classifiers see a deterministic receiver_kind on every
  // method-call CallReference.
  const call_site_syntax: CallSiteSyntax | undefined =
    call_type === "method"
      ? ref.kind === "method_call"
        ? ref.call_site_syntax
        : ref.kind === "self_reference_call"
        ? { receiver_kind: "self_keyword" }
        : undefined
      : undefined;

  // Omit optional fields entirely when absent — preserves the zero-overhead
  // invariant on the success / non-method path.
  return {
    ...base,
    ...(failure !== undefined && { resolution_failure: failure }),
    ...(call_site_syntax !== undefined && { call_site_syntax }),
  };
}

/**
 * Infers the semantic call type from the resolved symbol's definition.
 */
function infer_call_type_from_resolution(
  resolved_symbol: SymbolId,
  definitions: DefinitionRegistry,
  syntax_fallback: "function" | "method" | "constructor"
): "function" | "method" | "constructor" {
  const def = definitions.get(resolved_symbol);
  if (!def) return syntax_fallback;

  switch (def.kind) {
    case "constructor":
      return "constructor";
    case "method":
      return "method";
    case "function":
      return "function";
    default:
      return syntax_fallback;
  }
}

/**
 * Emit a synthetic invocation edge (receiver → callback) for each anonymous
 * function passed to a higher-order function, so callbacks are not reported as
 * unreachable.
 */
function resolve_callback_invocations(
  file_ids: Set<FilePath>,
  references: ReferenceRegistry,
  definitions: DefinitionRegistry
): CallReference[] {
  const invocations: CallReference[] = [];

  const all_callables = definitions.get_callable_definitions();

  for (const callable of all_callables) {
    if (callable.name !== ("<anonymous>" as SymbolName)) {
      continue;
    }

    if (!file_ids.has(callable.location.file_path)) {
      continue;
    }

    // Only FunctionDefinition carries callback_context.
    if (callable.kind !== "function") {
      continue;
    }

    const callback_context = callable.callback_context;

    if (!callback_context || !callback_context.is_callback) {
      continue;
    }

    if (!callback_context.receiver_location) {
      continue;
    }

    const file_refs = references.get_file_references(
      callback_context.receiver_location.file_path
    );

    const receiver_location = callback_context.receiver_location;
    const receiver_call = file_refs.find(
      (ref) =>
        (ref.kind === "function_call" || ref.kind === "method_call") &&
        ref.location.start_line === receiver_location.start_line &&
        ref.location.start_column === receiver_location.start_column
    );

    if (!receiver_call) {
      continue;
    }

    invocations.push({
      location: callback_context.receiver_location,
      name: "<anonymous>" as SymbolName,
      scope_id: callable.defining_scope_id,
      call_type: "function",
      resolutions: [
        {
          symbol_id: callable.symbol_id,
          confidence: "certain" as const,
          reason: { type: "direct" as const },
        },
      ],
      is_callback_invocation: true,
    });
  }

  return invocations;
}
