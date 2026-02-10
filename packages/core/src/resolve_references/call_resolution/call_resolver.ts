/**
 * Call Resolution (Phase 2)
 *
 * Pure functions for resolving call references to their target symbols.
 * Uses type information and name resolutions from Phase 1.
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
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";
import type { ScopeRegistry } from "../registries/scope";
import type { ReferenceRegistry } from "../registries/reference";
import type { ImportGraph } from "../../project/import_graph";
import type { CallResolutionResult } from "../resolution_state";
import type { ResolutionRegistry } from "../resolve_references";
import { process_collection_reads } from "../indirect_reachability";
import { resolve_method_call } from "./method";
import { resolve_constructor_call } from "./constructor";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_callable_instance } from "./callable_instance.python";
import { find_enclosing_function_scope } from "../../index_single_file/scopes/utils";

/**
 * Find alternative resolution by skipping method/constructor definitions.
 *
 * When a function_call resolves to a method (which requires a receiver),
 * walk up the scope tree to find an import or function with the same name.
 *
 * @param ref - The function call reference
 * @param context - Call resolution context
 * @param resolver - Name resolution provider
 * @returns The resolved SymbolId or null if no valid resolution found
 */
function find_function_resolution(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): SymbolId | null {
  const initial = resolver.resolve(ref.scope_id, ref.name);
  if (!initial) return null;

  // Check if resolution is valid for a function call
  const def = context.definitions.get(initial);
  if (!def) return initial; // Trust unresolved symbols

  // Methods and constructors require receivers - can't be called as bare functions
  if (def.kind !== "method" && def.kind !== "constructor") {
    return initial; // Valid: function, variable, import
  }

  // Resolved to method/constructor - this can't be the target of a bare function call
  // Find alternative by walking up from the class scope
  const method_body_scope = def.body_scope_id;
  if (!method_body_scope) return null;

  const body_scope = context.scopes.get_scope(method_body_scope);
  if (!body_scope?.parent_id) return null;

  // Class scope's parent should be module scope with imports
  const class_scope = context.scopes.get_scope(body_scope.parent_id);
  if (!class_scope?.parent_id) return null;

  // Try resolving from module scope (where imports live)
  const alternative = resolver.resolve(class_scope.parent_id, ref.name);
  if (!alternative) return null;

  // Verify the alternative is valid for a function call
  const alt_def = context.definitions.get(alternative);
  if (!alt_def) return alternative;

  if (alt_def.kind === "method" || alt_def.kind === "constructor") {
    return null; // Still a method/constructor - no valid resolution
  }

  return alternative;
}

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
 * Function type for resolving symbol names in scopes.
 * Used to decouple call resolution from the state storage mechanism.
 */
export type NameResolver = (
  scope_id: ScopeId,
  name: SymbolName
) => SymbolId | null;

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
  context: CallResolutionContext,
  name_resolver: NameResolver
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

  // Create resolution provider object that implements the resolve method
  // Cast to ResolutionRegistry for compatibility with existing resolver functions
  const resolution_provider = {
    resolve: name_resolver,
  } as ResolutionRegistry;

  // Resolve all calls
  const resolved_calls = resolve_calls(
    file_references,
    context,
    resolution_provider
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

  // Process collection reads to mark stored functions as indirectly reachable
  // Cast name_resolver to SymbolResolver - types are compatible (ScopeId extends string)
  const indirect_reachability = process_collection_reads(
    file_references,
    context.definitions,
    (scope_id, name) => name_resolver(scope_id as ScopeId, name)
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
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): CallReference[] {
  const resolved_calls: CallReference[] = [];

  for (const references of file_references.values()) {
    for (const ref of references) {
      let resolved_symbols: SymbolId[] = [];

      // Dispatch on discriminated union kind field
      switch (ref.kind) {
        case "self_reference_call":
        case "method_call":
          // Unified method call resolution for both:
          // - Self-reference calls: this.method(), self.method(), super.method()
          // - Method calls: obj.method(), obj.field.method()
          resolved_symbols = resolve_method_call(
            ref,
            context.scopes,
            context.definitions,
            context.types,
            resolver,
            (import_id) => context.imports.get_resolved_import_path(import_id)
          );

          // If standard resolution failed, try collection dispatch resolution
          if (resolved_symbols.length === 0) {
            resolved_symbols = resolve_collection_dispatch(
              ref,
              context.definitions,
              resolver
            );
          }
          break;

        case "function_call": {
          // Function calls: func() - no receiver
          // Methods and constructors require receivers, so can't match
          const func_symbol = find_function_resolution(ref, context, resolver);

          if (func_symbol) {
            resolved_symbols = [func_symbol];
          } else {
            resolved_symbols = [];
          }

          // Check for collection dispatch
          let try_dispatch = resolved_symbols.length === 0;
          if (resolved_symbols.length === 1) {
            const def = context.definitions.get(resolved_symbols[0]);
            if (
              def &&
              (def.kind === "variable" || def.kind === "constant") &&
              def.collection_source
            ) {
              try_dispatch = true;
            }
          }

          if (try_dispatch) {
            const dispatch_ids = resolve_collection_dispatch(
              ref,
              context.definitions,
              resolver
            );
            if (dispatch_ids.length > 0) {
              resolved_symbols = dispatch_ids;
            }
          }

          // Python-specific: Check for callable instance (__call__ method)
          if (
            resolved_symbols.length === 1 &&
            ref.location.file_path.endsWith(".py")
          ) {
            const call_method = resolve_callable_instance(
              resolved_symbols[0],
              context.definitions,
              context.types
            );
            if (call_method) {
              resolved_symbols = [call_method];
            }
          }
          break;
        }

        case "constructor_call":
          // Constructor calls: new MyClass()
          resolved_symbols = resolve_constructor_call(
            ref,
            context.definitions,
            resolver,
            context.types
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
            `Unhandled reference kind: ${(_exhaustive as unknown as { kind: string }).kind}`
          );
        }
      }

      // Build CallReference with Resolution metadata
      if (resolved_symbols.length > 0) {
        const call_ref = build_call_reference(
          ref as CallSymbolReference,
          resolved_symbols,
          context.definitions
        );
        resolved_calls.push(call_ref);
      }
    }
  }

  return resolved_calls;
}

/**
 * Build a CallReference from resolved symbols.
 */
function build_call_reference(
  ref: CallSymbolReference,
  resolved_symbols: SymbolId[],
  definitions: DefinitionRegistry
): CallReference {
  const primary_resolved = resolved_symbols[0];

  // Determine call_type from resolved symbol (semantic) with syntax as fallback
  let call_type: "function" | "method" | "constructor";
  switch (ref.kind) {
    case "self_reference_call":
    case "method_call":
      call_type = infer_call_type_from_resolution(
        primary_resolved,
        definitions,
        "method"
      );
      break;
    case "function_call":
      call_type = infer_call_type_from_resolution(
        primary_resolved,
        definitions,
        "function"
      );
      break;
    case "constructor_call":
      call_type = infer_call_type_from_resolution(
        primary_resolved,
        definitions,
        "constructor"
      );
      break;
    default: {
      const _exhaustive_call: never = ref;
      throw new Error(
        `Cannot convert reference to CallReference: ${(_exhaustive_call as unknown as { kind: string }).kind}`
      );
    }
  }

  // Detect interface implementations
  const is_interface_impl =
    call_type === "method" && resolved_symbols.length > 1;

  return {
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
