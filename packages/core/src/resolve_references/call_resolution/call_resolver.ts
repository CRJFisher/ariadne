/**
 * Call Resolution (Phase 2)
 *
 * Resolves call references to their target symbols using type information
 * and name resolutions from Phase 1.
 *
 * Note: `resolve_calls` has a type-registry side effect for Python namespace
 * constructors. When a method call with `potential_construct_target` resolves
 * to a class (e.g., `user = models.User(name)`), the variable's type is
 * registered in the TypeRegistry so subsequent method calls on it can resolve.
 */

import type {
  SymbolId,
  FilePath,
  CallReference,
  SymbolReference,
  ScopeId,
  SymbolName,
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  ConstructorCallReference,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { location_key, is_err, is_ok } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";
import type { ScopeRegistry } from "../registries/scope";
import type { ReferenceRegistry } from "../registries/reference";
import type { ImportGraph } from "../../project/import_graph";
import type { CallResolutionResult } from "../resolution_state";
import type { ResolutionRegistry } from "../resolve_references";
import { detect_indirect_reachability } from "../indirect_reachability";
import { resolve_method_call } from "./method_call";
import { resolve_constructor_call, include_constructors_for_class_symbols } from "./constructor";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_function_call } from "./function_call";
import { find_enclosing_function_scope } from "../../index_single_file/scopes/utils";

/**
 * Union type for call-related references only.
 * Used to ensure type safety in build_call_reference.
 */
type CallSymbolReference =
  | SelfReferenceCall
  | MethodCallReference
  | FunctionCallReference
  | ConstructorCallReference;

/**
 * Context bundle for call resolution.
 * Groups related parameters for cleaner function signatures.
 */
export interface CallResolutionContext {
  readonly references: ReferenceRegistry;
  readonly scopes: ScopeRegistry;
  readonly types: TypeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly imports: ImportGraph;
  readonly resolutions: ResolutionRegistry;
}

/**
 * PHASE 2: Resolve all call references for a set of files.
 *
 * Call Resolution (type-aware):
 *   1. Get call references from ReferenceRegistry
 *   2. Resolve function/method/constructor calls (uses TypeRegistry)
 *   3. Return resolved call references grouped by file and caller scope
 *
 * Pure function: computes new call resolutions from scratch.
 *
 * @param file_ids - Files that need call resolution updates
 * @param context - Call resolution context with all required registries
 * @param name_resolver - Function for resolving symbol names in scopes
 * @returns Call resolution result to be applied to state
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

  // Get references from ReferenceRegistry (source of truth)
  const file_references = new Map<FilePath, readonly SymbolReference[]>();
  for (const file_id of file_ids) {
    const refs = context.references.get_file_references(file_id);
    if (refs.length > 0) {
      file_references.set(file_id, refs);
    }
  }

  // Resolve all calls
  const resolved_calls = resolve_calls(
    file_references,
    context
  );

  // Resolve callback invocations for anonymous functions
  const callback_invocations = resolve_callback_invocations(
    file_ids,
    context.references,
    context.definitions
  );

  // Combine regular calls with callback invocations
  const all_calls = [...resolved_calls, ...callback_invocations];

  // Group resolved calls by file AND by caller scope
  const calls_by_file = new Map<FilePath, CallReference[]>();
  const calls_by_caller = new Map<ScopeId, CallReference[]>();

  for (const call of all_calls) {
    // Calculate caller scope (the function/method/constructor that contains this call)
    const caller_scope_id = find_enclosing_function_scope(
      call.scope_id,
      context.scopes.get_all_scopes()
    );

    // Add caller_scope_id to the call
    const enriched_call: CallReference = {
      ...call,
      caller_scope_id,
    } as CallReference;

    // Group by file
    const file_path = enriched_call.location.file_path;
    const existing_file = calls_by_file.get(file_path);
    if (existing_file) {
      existing_file.push(enriched_call);
    } else {
      calls_by_file.set(file_path, [enriched_call]);
    }

    // Group by caller scope (for O(1) lookup in call graph)
    if (caller_scope_id) {
      const existing_caller = calls_by_caller.get(caller_scope_id);
      if (existing_caller) {
        existing_caller.push(enriched_call);
      } else {
        calls_by_caller.set(caller_scope_id, [enriched_call]);
      }
    }
  }

  // Build final resolved_calls_by_file (ensure all file_ids have entries)
  const resolved_calls_by_file = new Map<FilePath, readonly CallReference[]>();
  for (const file_id of file_ids) {
    resolved_calls_by_file.set(file_id, calls_by_file.get(file_id) ?? []);
  }

  // Detect indirect reachability (function collections and function-as-value references)
  const indirect_reachability = detect_indirect_reachability(
    file_references,
    context.definitions,
    (scope_id, name) => context.resolutions.resolve(scope_id as ScopeId, name)
  );

  return {
    resolved_calls_by_file,
    calls_by_caller_scope: calls_by_caller,
    indirect_reachability,
  };
}

/**
 * Resolve all call references (function, method, constructor, self-reference).
 *
 * Dispatch Logic:
 * - Uses discriminated union pattern matching on ref.kind
 * - Type narrowing provides type safety in each case
 * - Exhaustiveness checking ensures all variants handled
 *
 * @param file_references - Map of file_path → references
 * @param context - Call resolution context
 * @param resolver - Name resolution provider
 * @returns Array of resolved call references
 */
function resolve_calls(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  context: CallResolutionContext
): CallReference[] {
  const resolved_calls: CallReference[] = [];

  for (const references of file_references.values()) {
    for (const ref of references) {
      let dispatch_result: Result<SymbolId[], ResolutionFailure>;

      // Dispatch on discriminated union kind field
      switch (ref.kind) {
        case "self_reference_call":
        case "method_call": {
          // Unified method call resolution for both:
          // - Self-reference calls: this.method(), self.method(), super.method()
          // - Method calls: obj.method(), obj.field.method()
          const method_result = resolve_method_call(
            ref,
            context.scopes,
            context.definitions,
            context.types,
            context.resolutions,
            context.imports
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
          // Constructor calls: new MyClass() or new models.User()
          dispatch_result = resolve_constructor_call(
            ref,
            context.definitions,
            context.resolutions,
            (import_id) => context.imports.get_resolved_import_path(import_id)
          );
          break;

        case "variable_reference":
        case "property_access":
        case "type_reference":
        case "assignment":
          // Not call references - skip
          continue;

        default: {
          // Exhaustiveness checking
          const _exhaustive: never = ref;
          throw new Error(
            `Unhandled reference kind: ${(_exhaustive as { kind: string }).kind}`
          );
        }
      }

      let resolved_symbols: SymbolId[] = is_ok(dispatch_result)
        ? [...dispatch_result.value]
        : [];

      // Enrich: if any resolved symbol is a class, also reference its constructor
      resolved_symbols = include_constructors_for_class_symbols(
        resolved_symbols,
        context.definitions,
        context.resolutions
      );

      // Python namespace constructor: register type binding for the assigned variable
      // e.g., user = models.User(name) — after resolution, bind user's type to User
      if (ref.kind === "method_call" && ref.potential_construct_target) {
        // Find the class that this constructor-like call resolved to (e.g., models.User → User class)
        const resolved_class = resolved_symbols.find(
          (s) => context.definitions.get(s)?.kind === "class"
        );
        if (resolved_class) {
          // Look up the variable being assigned (e.g., `user` in `user = models.User(name)`)
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

      // Build CallReference with Resolution metadata. Emit a CallReference
      // even on failure so downstream consumers can read `resolution_failure`.
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
  // Determine call_type. When resolution failed there is no resolved symbol
  // to inspect, so fall back to the syntactic kind from `ref`.
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

  // Omit the field entirely on success — preserves the zero-overhead invariant
  // (Object.hasOwn(call, "resolution_failure") === false on the success path).
  return failure ? { ...base, resolution_failure: failure } : base;
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
 * Resolve callback invocations for anonymous functions passed to higher-order functions.
 *
 * Strategy:
 * 1. Find all anonymous functions with callback_context.is_callback = true
 * 2. For each callback, find the call reference at receiver_location
 * 3. Create a synthetic invocation edge marking the callback as "invoked"
 */
function resolve_callback_invocations(
  file_ids: Set<FilePath>,
  references: ReferenceRegistry,
  definitions: DefinitionRegistry
): CallReference[] {
  const invocations: CallReference[] = [];

  // Get all callable definitions (includes anonymous functions)
  const all_callables = definitions.get_callable_definitions();

  for (const callable of all_callables) {
    // Only process anonymous functions with callback context
    if (callable.name !== ("<anonymous>" as SymbolName)) {
      continue;
    }

    // Check if this file is being processed
    if (!file_ids.has(callable.location.file_path)) {
      continue;
    }

    // Only FunctionDefinition has callback_context
    if (callable.kind !== "function") {
      continue;
    }

    // Get callback context from function definition
    const callback_context = callable.callback_context;

    if (!callback_context || !callback_context.is_callback) {
      continue;
    }

    if (!callback_context.receiver_location) {
      continue;
    }

    // Find the call reference at the receiver location
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

    // Create synthetic call reference: receiver → callback
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
