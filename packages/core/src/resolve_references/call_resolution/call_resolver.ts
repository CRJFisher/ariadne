/**
 * Resolves call references to their target symbols using type information and
 * name resolutions.
 *
 * `resolve_calls` carries a type-registry side effect for Python namespace
 * constructors: when a method call with `potential_construct_target` resolves
 * to a class (e.g. `user = models.User(name)`), the variable's type is
 * registered in the TypeRegistry so subsequent method calls on it can resolve.
 *
 * ## What a pass costs, and the limit that sets
 *
 * A pass reads only what its batch names: references for the batch's files, and
 * the batch's own anonymous callables from `DefinitionRegistry`. Re-resolving
 * one file reads what that file holds however large the project around it is —
 * measured over vscode's `src/`, 8 callables at 1,200 files and 8 at 8,494,
 * against 212,275 when the pass asked for the project's whole callable set.
 *
 * What grows is polymorphic dispatch, and it grows because its answer does.
 * Over the same corpus, 927 → 8,494 files: unresolved call sites, the input,
 * grow at exponent 1.013; resolved call edges, the output, at 1.310; subtype
 * edges enumerated by `method_lookup` at 1.726; and CPU inside the polymorphic
 * pair at 1.881, taking it from 5.6% of this term to 22.9%. The mean fan-out of
 * one dispatch — subtypes enumerated per expansion — goes 4.64 → 16.77, because
 * a wider corpus is one in which an interface genuinely has more
 * implementations. Naming every possible runtime target is the capability, so
 * this cost is intrinsic rather than a scan to be indexed away.
 *
 * The term itself measures an exponent of 1.134 by least squares over 927,
 * 2,000 and 8,494 files, 1.506 between the two largest. Carried forward, it
 * reaches 10% of a load at 19,000-35,000 files and half of one at 232,000-2.7M,
 * where the memory contract already refuses: 8,494 files retain 4,046 MB live.
 * `RECORDED_CALL_RESOLUTION_GROWTH` holds the arms behind every figure here.
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
import type { CallResolutionResult } from "../resolution_state";
import {
  record_dispatch,
  record_subtype_dispatch,
  type SubtypeDispatchFiles,
} from "./subtype_dispatch";
import {
  gather_class_arguments,
  type GatheredClassArguments,
} from "./carried_class";
import type { ResolutionRegistry } from "../resolution_registry";
import {
  detect_indirect_reachability,
  record_indirect_reachability,
} from "../indirect_reachability";
import { resolve_callable_values } from "./callable_value";
import { resolve_read_value } from "./value_source";
import { resolve_method_call } from "./method_call";
import { create_method_call_reference } from "../../index_single_file/references/factories";
import { resolve_constructor_call, include_constructors_for_class_symbols } from "./constructor";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_function_call } from "./function_call";
import type { ModuleResolutionContext } from "../import_resolution";

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
  readonly modules: ModuleResolutionContext;
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
      subtype_dispatch_files: new Map(),
      undeclared_interface_files: new Map(),
      class_arguments_by_callee: new Map(),
    };
  }

  const file_references = new Map<FilePath, readonly SymbolReference[]>();
  for (const file_id of file_ids) {
    const refs = context.references.get_file_references(file_id);
    if (refs.length > 0) {
      file_references.set(file_id, refs);
    }
  }

  const {
    resolved_calls,
    subtype_dispatch_files,
    undeclared_interface_files,
    class_arguments_by_callee,
  } = resolve_calls(file_references, context);

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
    (scope_id, name) => context.resolutions.resolve(scope_id as ScopeId, name),
    (scope_id, property_chain, read_at) => {
      const held = resolve_read_value(property_chain, scope_id as ScopeId, read_at, context);
      return held?.kind === "callable" ? held.symbol_id : null;
    }
  );
  const callable_values = resolve_callable_values(file_references, context);
  for (const [symbol_id, entry] of callable_values.reachable) {
    record_indirect_reachability(indirect_reachability, symbol_id, entry);
  }
  for (const [held, from_values] of [
    [subtype_dispatch_files, callable_values.subtype_dispatch_files],
    [undeclared_interface_files, callable_values.undeclared_interface_files],
  ] as const) {
    for (const [type_id, files] of from_values) {
      for (const file_id of files) {
        record_subtype_dispatch(held, type_id, file_id);
      }
    }
  }

  return {
    resolved_calls_by_file,
    calls_by_caller_scope: calls_by_caller,
    indirect_reachability,
    subtype_dispatch_files,
    undeclared_interface_files,
    class_arguments_by_callee,
  };
}

/**
 * Resolve all call references, dispatching on the discriminated `ref.kind`,
 * and record which files' method lookups enumerated which types' subtypes.
 */
function resolve_calls(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  context: CallResolutionContext
): {
  resolved_calls: CallReference[];
  subtype_dispatch_files: SubtypeDispatchFiles;
  undeclared_interface_files: SubtypeDispatchFiles;
  class_arguments_by_callee: GatheredClassArguments;
} {
  const resolved_calls: CallReference[] = [];
  const subtype_dispatch_files: SubtypeDispatchFiles = new Map();
  const undeclared_interface_files: SubtypeDispatchFiles = new Map();
  const class_arguments_by_callee: GatheredClassArguments = new Map();

  for (const references of file_references.values()) {
    for (const ref of references) {
      let dispatch_result: Result<SymbolId[], ResolutionFailure>;

      switch (ref.kind) {
        case "self_reference_call":
        case "method_call": {
          // Self-reference calls (this/self/super.method()) and receiver method
          // calls (obj.method()) share one resolution path.
          const method_lookup = resolve_method_call(
            ref,
            context.scopes,
            context.definitions,
            context.types,
            context.resolutions,
            context.imports,
            context.exports,
            context.languages,
            context.modules
          );
          const method_result = method_lookup.targets;
          // Recorded whichever branch below supplies the answer: a collection
          // fallback answers only while the lookup misses, so the lookup's
          // subtype closure still decides it.
          record_dispatch(
            subtype_dispatch_files,
            undeclared_interface_files,
            method_lookup,
            ref.location.file_path
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
          dispatch_result = resolve_constructor_call(ref, context);
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
          //
          // A property read is therefore outside the resolved-plus-failed
          // invariant that every call-kind reference ends as one CallReference
          // with a target or a reason: a read that reaches a getter adds a
          // CallReference beside the call kinds, and one that does not adds
          // nothing, because there was no call to leave unexplained.
          const getter_call = create_method_call_reference(
            ref.name,
            ref.location,
            ref.scope_id,
            ref.receiver_location,
            ref.property_chain,
            ref.is_optional_chain
          );
          const getter_lookup = resolve_method_call(
            getter_call,
            context.scopes,
            context.definitions,
            context.types,
            context.resolutions,
            context.imports,
            context.exports,
            context.languages,
            context.modules
          );
          record_dispatch(
            subtype_dispatch_files,
            undeclared_interface_files,
            getter_lookup,
            ref.location.file_path
          );
          const getters = (
            is_ok(getter_lookup.targets) ? getter_lookup.targets.value : []
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
        // build_call_reference exhaustive over call kinds only. None of these
        // four is a call, so none is counted by the resolved-plus-failed
        // invariant; only the call kinds above owe a target or a reason.
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
        context.definitions
      );

      // A class named as an argument is the only evidence that types the
      // parameter it binds, and it is written here, in the caller's file,
      // while the construction that reads it sits in the callee's.
      if (ref.kind === "function_call") {
        gather_class_arguments(class_arguments_by_callee, ref, resolved_symbols, context);
      }

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
      // `resolution_failure`. A dispatch that succeeded with nothing is refused
      // rather than passed through: a CallReference with no target and no reason
      // is a call the failure taxonomy cannot count, which leaves the taxonomy
      // short of the call references it is stated over.
      const failure: ResolutionFailure | undefined =
        resolved_symbols.length > 0
          ? undefined
          : is_err(dispatch_result)
            ? dispatch_result.error
            : refuse_unexplained_dispatch(ref as CallSymbolReference);

      const call_ref = build_call_reference(
        ref as CallSymbolReference,
        resolved_symbols,
        context.definitions,
        failure
      );
      resolved_calls.push(call_ref);
    }
  }

  return {
    resolved_calls,
    subtype_dispatch_files,
    undeclared_interface_files,
    class_arguments_by_callee,
  };
}

/**
 * Refuse a dispatch that succeeded with no target.
 *
 * No producer in `call_resolution/` returns `ok([])` — every path that finds
 * nothing returns `err` with the reason it observed — but the result type
 * permits it, and the resolved-plus-failed invariant is a property of the
 * CallReferences this file emits, not of each producer. Naming a reason here
 * would be inventing one: the resolver did not observe a fan-out that came back
 * empty, it observed a producer that broke its contract, and a reason recorded
 * on that basis is indistinguishable in a corpus baseline from one a producer
 * actually reached. So the exit is closed by refusing, like the `never` check
 * over `ref.kind` above, and `count_failure_taxonomy` never has to sum over a
 * call it cannot explain.
 */
function refuse_unexplained_dispatch(ref: CallSymbolReference): never {
  throw new Error(
    `Dispatch for the ${ref.kind} "${ref.name}" at ${location_key(ref.location)} succeeded with no target. ` +
      "A producer that finds nothing has to return err with the reason it observed; a call with neither a target nor a reason cannot be counted.",
  );
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

  // method_lookup puts the member the call names first and its polymorphic
  // expansion after, so the head fixes the reason every element carries: when
  // an interface declares the head, the rest reach it by implementing it, and
  // the interface to name is the one that declares the member. A class
  // dispatch (base + overrides) has no interface head, so every element is
  // direct.
  const head_owner =
    resolved_symbols.length > 1
      ? definitions.get_member_owner(resolved_symbols[0])
      : undefined;
  const interface_id =
    head_owner !== undefined &&
    definitions.get(head_owner)?.kind === "interface"
      ? head_owner
      : undefined;

  const base = {
    location: ref.location,
    name: ref.name,
    scope_id: ref.scope_id,
    call_type,
    resolutions: resolved_symbols.map((symbol_id, index) => ({
      symbol_id,
      confidence: "certain" as const,
      reason:
        interface_id !== undefined && index > 0
          ? ({
              type: "interface_implementation" as const,
              interface_id,
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
 *
 * The invocation happens where the receiver call is written, so it carries the
 * receiver call's scope — not the callback's `defining_scope_id`. An arrow's
 * definition spans exactly its own function scope, so that field names the
 * arrow itself and the enclosing-function walk in `resolve_calls_for_files`
 * would return the callback as its own caller, hiding both the real caller's
 * reach and the callback's own unreachability.
 *
 * The batch's own files are asked for their anonymous callables, so what this
 * pass reads is a property of the batch and not of how much else the project
 * holds.
 */
function resolve_callback_invocations(
  file_ids: Set<FilePath>,
  references: ReferenceRegistry,
  definitions: DefinitionRegistry
): CallReference[] {
  const invocations: CallReference[] = [];

  for (const file_id of file_ids) {
    for (const callable of definitions.get_anonymous_callables_in_file(file_id)) {
      const callback_context = callable.callback_context;

      if (!callback_context || !callback_context.is_callback) {
        continue;
      }

      const receiver_location = callback_context.receiver_location;
      if (!receiver_location) {
        continue;
      }

      const file_refs = references.get_file_references(
        receiver_location.file_path
      );

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
        location: receiver_location,
        name: "<anonymous>" as SymbolName,
        scope_id: receiver_call.scope_id,
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
  }

  return invocations;
}
