/**
 * Receiver Resolution Module
 *
 * Resolves receiver expressions to their types for method call resolution.
 * This module unifies the handling of both self-reference calls (this.method())
 * and regular method calls (obj.method()) through a two-phase approach:
 *
 * Phase 1: Resolve the base of the receiver expression
 *   - Self-reference keywords (this, self, super, cls) → containing class type
 *   - Identifiers → resolve in scope, get type
 *
 * Phase 2: Walk the property chain to get the final receiver type
 *   - For each property, look up member on current type
 *   - Get member's type for next iteration
 *
 * This architecture allows natural composition:
 *   - this.method() → resolve this → class type → lookup method
 *   - this.property.method() → resolve this → class type → property type → lookup method
 *   - obj.field.method() → resolve obj → type → field type → lookup method
 */

import type {
  SymbolId,
  SymbolName,
  FilePath,
  ScopeId,
  Language,
  SelfReferenceCall,
  MethodCallReference,
  SelfReferenceKeyword,
  ChainCallArguments,
  MethodDefinition,
  AnyDefinition,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import { resolve_namespace_export } from "../export_chain_lookup";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";
import type { ExportRegistry } from "../registries/export";
import type { ResolutionRegistry } from "../resolution_registry";
import type { ImportGraph } from "../import_resolution/import_graph";
import type { ModuleResolutionContext } from "../import_resolution";

/**
 * Receiver expression - normalized form for both self-reference and method calls
 */
export interface ReceiverExpression {
  readonly base:
    | { type: "keyword"; value: SelfReferenceKeyword }
    | { type: "identifier"; value: SymbolName };
  /** Properties between the base and the method being called, both excluded. */
  readonly chain: readonly SymbolName[];
  /**
   * Call arguments for each `chain` position, aligned index-for-index (`null`
   * where that position is not an invoked call). Carries the type-token
   * argument (`injector.get(Token)`) into generic-return inference. Absent when
   * the receiver has no chained-call arguments.
   */
  readonly chain_arguments?: ChainCallArguments;
  readonly method_name: SymbolName;
  readonly scope_id: ScopeId;
}

/**
 * Registries needed to infer the type of a receiver expression and look up
 * methods on that type (phases 1 and 2 of receiver resolution).
 */
export interface ReceiverResolutionContext {
  readonly scopes: ScopeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly types: TypeRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly imports: ImportGraph;
  readonly exports: ExportRegistry;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly modules: ModuleResolutionContext;
}

const SELF_REFERENCE_KEYWORDS = new Set(["this", "self", "super", "cls"]);

/**
 * Normalize a SelfReferenceCall or MethodCallReference into a ReceiverExpression.
 *
 * Both carry a flat property_chain of `[base, ...properties, method_name]`. The base is
 * a self-reference keyword for self_reference_call, and either a keyword or an
 * identifier for method_call — `this.property.method()` is frequently indexed as
 * method_call, so a leading keyword there is still a keyword base, not an identifier.
 */
export function extract_receiver(
  ref: SelfReferenceCall | MethodCallReference
): ReceiverExpression {
  const chain = ref.property_chain;

  if (ref.kind === "self_reference_call") {
    return {
      base: { type: "keyword", value: ref.keyword },
      chain: chain.slice(1, -1) as SymbolName[],
      method_name: ref.name,
      scope_id: ref.scope_id,
    };
  }

  const first_element = chain[0] as string;
  if (SELF_REFERENCE_KEYWORDS.has(first_element)) {
    return {
      base: { type: "keyword", value: first_element as SelfReferenceKeyword },
      chain: chain.slice(1, -1) as SymbolName[],
      method_name: ref.name,
      scope_id: ref.scope_id,
    };
  }

  const chain_arguments =
    ref.kind === "method_call" && ref.property_chain_arguments
      ? ref.property_chain_arguments.slice(1, -1)
      : undefined;

  return {
    base: { type: "identifier", value: chain[0] as SymbolName },
    chain: chain.slice(1, -1) as SymbolName[],
    ...(chain_arguments !== undefined && { chain_arguments }),
    method_name: ref.name,
    scope_id: ref.scope_id,
  };
}

/**
 * Resolve a receiver expression to the SymbolId of its type.
 *
 * Phase 1 resolves the base (keyword or identifier) to a type; phase 2 walks the
 * property chain to reach the final receiver type. Returns a `ResolutionFailure`
 * describing where resolution stopped.
 */
export function resolve_receiver_type(
  receiver: ReceiverExpression,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  const base_result = resolve_base(receiver.base, receiver.scope_id, context);
  if (!base_result.ok) {
    return base_result;
  }

  if (receiver.chain.length === 0) {
    return base_result;
  }

  return walk_property_chain(
    base_result.value,
    receiver.chain,
    receiver.chain_arguments,
    receiver.scope_id,
    context
  );
}

/**
 * Resolve the base of a receiver expression to a type
 */
function resolve_base(
  base: ReceiverExpression["base"],
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  if (base.type === "keyword") {
    return resolve_keyword_base(base.value, scope_id, context);
  } else {
    return resolve_identifier_base(base.value, scope_id, context);
  }
}

/**
 * Resolve a self-reference keyword to its type
 */
function resolve_keyword_base(
  keyword: SelfReferenceKeyword,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  const class_scope_id = find_containing_class_scope(scope_id, context.scopes, context.definitions);
  if (!class_scope_id) {
    // Object-literal methods and prototype/member-assigned functions have no
    // enclosing class scope. Bind `this`/self to the function collection whose
    // body encloses the call so `this.method()` resolves against its siblings.
    if (keyword !== "super") {
      const scope = context.scopes.get_scope(scope_id);
      if (scope) {
        const collection_id = context.definitions.find_enclosing_collection(scope.location);
        if (collection_id) {
          return ok(collection_id);
        }
      }
    }

    return err({
      stage: "receiver_resolution",
      reason: "no_enclosing_class_scope",
      partial_info: { last_known_scope: scope_id },
    });
  }

  const class_symbol_id = find_class_from_scope(class_scope_id, context.definitions);
  if (!class_symbol_id) {
    return err({
      stage: "receiver_resolution",
      reason: "class_definition_not_found",
      partial_info: { last_known_scope: class_scope_id },
    });
  }

  // super dispatches against the parent class; index 0 is the current class.
  if (keyword === "super") {
    const inheritance_chain = context.types.walk_inheritance_chain(class_symbol_id);
    if (inheritance_chain.length < 2) {
      return err({
        stage: "receiver_resolution",
        reason: "no_parent_class",
        partial_info: { resolved_receiver_type: class_symbol_id },
      });
    }
    return ok(inheritance_chain[1]);
  }

  return ok(class_symbol_id);
}

/**
 * Resolve an identifier receiver to a type SymbolId.
 */
function resolve_identifier_base(
  identifier: SymbolName,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  const symbol_id = context.resolutions.resolve(scope_id, identifier);
  if (!symbol_id) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: scope_id },
    });
  }

  const def = context.definitions.get(symbol_id);

  // An import or a function-collection variable has no followable type of its own;
  // method_lookup resolves methods against the module exports or collection instead.
  if (def?.kind === "import") {
    return ok(symbol_id);
  }
  if (def?.kind === "variable" || def?.kind === "constant") {
    const fn_collection = context.definitions.get_function_collection(symbol_id);
    if (fn_collection) {
      return ok(symbol_id);
    }
  }

  let type_id = context.types.get_symbol_type(symbol_id);

  if (!type_id && def) {
    // A type used as a receiver (Type.staticMethod(), Type::associated_function())
    // is its own type; otherwise fall back to a resolvable type annotation.
    if (
      def.kind === "class" ||
      def.kind === "interface" ||
      def.kind === "enum" ||
      def.kind === "type" ||
      def.kind === "type_alias" ||
      // A namespace is its own receiver: `Core.f()` walks into its body scope
      // rather than through a type.
      def.kind === "namespace"
    ) {
      type_id = symbol_id;
    } else if (
      (def.kind === "variable" ||
        def.kind === "constant" ||
        def.kind === "property" ||
        def.kind === "parameter") &&
      def.type
    ) {
      type_id = context.resolutions.resolve(def.defining_scope_id, def.type);
    }
  }

  if (!type_id) {
    return err({
      stage: "type_inference",
      reason: "receiver_type_unknown",
      partial_info: { last_known_scope: scope_id },
    });
  }

  return ok(type_id);
}

/**
 * Resolve `property_name` against a hop that is a namespace rather than a type:
 * a TypeScript `namespace` block, whose members live in its own body scope, or
 * a namespace import, whose members are the exports of the module it names.
 * Returns null for any other hop kind, leaving the caller's failure intact.
 */
function resolve_namespace_member(
  current: SymbolId,
  property_name: SymbolName,
  context: ReceiverResolutionContext
): SymbolId | null {
  const named = dereference_named_import(current, context);
  if (!named) {
    return null;
  }
  const def = context.definitions.get(named);

  if (def?.kind === "namespace") {
    return resolve_namespace_scope_member(def, property_name, context);
  }

  if (def?.kind === "import" && def.import_kind === "namespace") {
    const source_file = context.imports.get_resolved_import_path(current);
    if (!source_file) {
      return null;
    }
    return resolve_namespace_export(
      source_file,
      property_name,
      context.exports,
      context.languages,
      context.modules
    );
  }

  return null;
}

/**
 * Follow a named or default import to the definition it names, so a hop
 * written as `import { Ns } from …; Ns.Inner.f()` descends into the namespace
 * itself rather than stopping at the import record. A namespace import is left
 * alone: it denotes the module, which the caller resolves against its exports.
 *
 * Termination is the visited set `ExportRegistry.resolve_export_chain` threads:
 * re-entering a symbol means the chain is circular, so it names no definition
 * and resolves to null rather than to an arbitrary link on the cycle. A chain
 * that merely runs deep is followed to its end.
 */
function dereference_named_import(
  symbol_id: SymbolId,
  context: ReceiverResolutionContext
): SymbolId | null {
  let current = symbol_id;
  const visited = new Set<SymbolId>([current]);

  for (;;) {
    const def = context.definitions.get(current);
    if (def?.kind !== "import" || def.import_kind === "namespace") {
      return current;
    }
    const source_file = context.imports.get_resolved_import_path(current);
    if (!source_file) {
      return current;
    }
    const imported_name = (def.original_name ?? def.name) as SymbolName;
    const resolved = context.exports.resolve_export_chain(
      source_file,
      imported_name,
      def.import_kind === "default" ? "default" : "named",
      context.languages,
      context.modules
    );
    if (!resolved) {
      return current;
    }
    if (visited.has(resolved)) {
      return null;
    }
    visited.add(resolved);
    current = resolved;
  }
}

/**
 * Look a name up in a `namespace` block's own body scope — the members neither
 * the type registry nor the member index records. Shared with the terminal
 * lookup in method_lookup, so a chain hop and a call target descend alike.
 */
export function resolve_namespace_scope_member(
  namespace_def: AnyDefinition,
  member_name: SymbolName,
  context: ReceiverResolutionContext
): SymbolId | null {
  const body_scope_id = find_namespace_body_scope(namespace_def, context);
  if (!body_scope_id) {
    return null;
  }
  return (
    context.definitions.get_scope_definitions(body_scope_id).get(member_name) ?? null
  );
}

/**
 * The scope a namespace declaration opens: the declaring scope's module-typed
 * child carrying the same name. A `@scope.namespace` capture is stored with
 * ScopeType "module" and keeps the namespace's declared name.
 */
function find_namespace_body_scope(
  namespace_def: AnyDefinition,
  context: ReceiverResolutionContext
): ScopeId | null {
  const declaring_scope = context.scopes.get_scope(namespace_def.defining_scope_id);
  for (const child_id of declaring_scope?.child_ids ?? []) {
    const child = context.scopes.get_scope(child_id);
    if (child?.type === "module" && child.name === namespace_def.name) {
      return child_id;
    }
  }
  return null;
}

/**
 * Walk a property chain, resolving each property to its member's type so the next
 * property is looked up on that type, and returning the final type.
 */
function walk_property_chain(
  start_type: SymbolId,
  chain: readonly SymbolName[],
  chain_arguments: ChainCallArguments | undefined,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  let current_type = start_type;

  for (let index = 0; index < chain.length; index++) {
    const property_name = chain[index];
    let member_symbol = context.types.get_type_member(current_type, property_name);

    // The member index catches members the TypeRegistry has not resolved a type for.
    if (!member_symbol) {
      const member_index = context.definitions.get_member_index();
      const type_members = member_index.get(current_type);
      if (type_members) {
        member_symbol = type_members.get(property_name) || null;
      }
    }

    // A namespace hop resolves through neither: a TypeScript `namespace` block
    // holds its members in its own scope, and a namespace import holds them in
    // the module it points at.
    if (!member_symbol) {
      member_symbol = resolve_namespace_member(current_type, property_name, context);
    }

    if (!member_symbol) {
      return err({
        stage: "receiver_resolution",
        reason: "method_not_on_type",
        partial_info: { resolved_receiver_type: current_type },
      });
    }

    let member_type = context.types.get_symbol_type(member_symbol);

    if (!member_type) {
      const member_def = context.definitions.get(member_symbol);
      if (member_def) {
        if (
          member_def.kind === "class" ||
          member_def.kind === "interface" ||
          member_def.kind === "enum" ||
          member_def.kind === "type" ||
          member_def.kind === "type_alias" ||
          // A namespace or a namespace import is its own receiver for the next
          // hop, which descends into it the same way this one did.
          member_def.kind === "namespace" ||
          member_def.kind === "import"
        ) {
          member_type = member_symbol;
        } else if (
          (member_def.kind === "property" || member_def.kind === "parameter") &&
          member_def.type
        ) {
          member_type = context.resolutions.resolve(
            member_def.defining_scope_id,
            member_def.type
          );
        } else if (member_def.kind === "method") {
          // @language typescript
          // A generic method returning its own type parameter (get<T>(): T) has
          // no resolvable return type until the parameter is bound. When the
          // binding parameter is a type token (token: Type<T>), infer T from the
          // call's token argument at this chain position.
          member_type = infer_generic_return_from_type_token(
            member_def,
            chain_arguments?.[index] ?? null,
            scope_id,
            context
          );
        }
      }
    }

    if (!member_type) {
      return err({
        stage: "type_inference",
        reason: "member_type_unknown",
        partial_info: { resolved_receiver_type: current_type },
      });
    }

    current_type = member_type;
  }

  return ok(current_type);
}

// @language typescript
/**
 * Infer the concrete return type of a generic method whose return type is one
 * of its own type parameters bound by a type-token parameter — the DI shape
 * `get<T>(token: Type<T>): T`. Returns the type the token argument names, or
 * null when the method is not that shape or the argument cannot be resolved
 * (leaving the caller's `member_type_unknown` failure intact).
 */
function infer_generic_return_from_type_token(
  method_def: MethodDefinition,
  call_arguments_at_position: readonly (SymbolName | null)[] | null,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): SymbolId | null {
  const return_type = method_def.return_type;
  if (!return_type || !method_def.generics?.includes(return_type)) {
    return null;
  }
  if (!call_arguments_at_position) {
    return null;
  }

  // The token parameter is the one whose declared type wraps the return-type
  // parameter exactly (token: Type<T> for a method returning T).
  const token_index = method_def.parameters.findIndex(
    (param) =>
      param.type !== undefined &&
      parse_single_type_argument(param.type) === return_type
  );
  if (token_index < 0) {
    return null;
  }

  const argument_name = call_arguments_at_position[token_index] ?? null;
  if (!argument_name) {
    return null;
  }

  return resolve_token_argument_type(argument_name, scope_id, context);
}

// @language typescript
/**
 * Resolve a type-token argument to the class it designates: a class/type used
 * directly (`injector.get(Service)`) is its own type; a typed token binding
 * (a parameter `token: Type<Service>`) resolves through its `Type<…>`
 * annotation to the wrapped class.
 */
function resolve_token_argument_type(
  argument_name: SymbolName,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): SymbolId | null {
  const symbol_id = context.resolutions.resolve(scope_id, argument_name);
  if (!symbol_id) {
    return null;
  }

  const def = context.definitions.get(symbol_id);
  if (!def) {
    return null;
  }

  if (
    def.kind === "class" ||
    def.kind === "interface" ||
    def.kind === "enum" ||
    def.kind === "type" ||
    def.kind === "type_alias"
  ) {
    return symbol_id;
  }

  if (
    (def.kind === "variable" ||
      def.kind === "constant" ||
      def.kind === "parameter" ||
      def.kind === "property") &&
    def.type
  ) {
    const wrapped_type = parse_single_type_argument(def.type);
    if (wrapped_type) {
      return context.resolutions.resolve(def.defining_scope_id, wrapped_type);
    }
  }

  return null;
}

// @language typescript
/**
 * The single type argument of a `Wrapper<Inner>` annotation (`Type<T>` → `T`),
 * or null when the annotation is not a single-argument generic — no `<…>`, a
 * trailing modifier (`Type<T> | null`), or multiple arguments (`Map<K, V>`).
 */
function parse_single_type_argument(annotation: SymbolName): SymbolName | null {
  const open = annotation.indexOf("<");
  if (open < 0 || !annotation.endsWith(">")) {
    return null;
  }

  const inner = annotation.slice(open + 1, -1).trim();
  if (inner.length === 0) {
    return null;
  }

  // Reject multiple top-level arguments (Map<K, V>) while allowing a nested
  // single argument (Provider<Foo<Bar>>).
  let depth = 0;
  for (const char of inner) {
    if (char === "<") {
      depth++;
    } else if (char === ">") {
      depth--;
    } else if (char === "," && depth === 0) {
      return null;
    }
  }

  return inner as SymbolName;
}

/**
 * Walk up the scope tree to the class scope enclosing `start_scope_id`, or null if none.
 * `definitions` lets a Rust impl block — which is a `block` scope, not a `class` scope —
 * count as a class scope when it owns methods.
 */
export function find_containing_class_scope(
  start_scope_id: ScopeId,
  scopes: ScopeRegistry,
  definitions?: DefinitionRegistry
): ScopeId | null {
  let current_scope_id: ScopeId | null = start_scope_id;

  while (current_scope_id) {
    const scope = scopes.get_scope(current_scope_id);
    if (!scope) {
      return null;
    }

    if (scope.type === "class") {
      return current_scope_id;
    }

    // @language rust
    // A Rust impl block is a `block` scope; owning methods distinguishes it from a
    // plain block (if/for/loop), which never owns class members.
    if (scope.type === "block" && definitions) {
      if (find_class_from_scope(current_scope_id, definitions)) {
        return current_scope_id;
      }
    }

    current_scope_id = scope.parent_id;
  }

  return null;
}

/**
 * Find the class definition owning a class scope, by locating any method defined in the
 * scope and reverse-looking-up its owner through the member index. The scope tree alone
 * does not link a class body back to its class symbol.
 */
export function find_class_from_scope(
  class_scope_id: ScopeId,
  definitions: DefinitionRegistry
): SymbolId | null {
  const scope_symbols = definitions.get_scope_definitions(class_scope_id);
  if (!scope_symbols) {
    return null;
  }

  // The scope index is keyed by name, so a getter/setter pair leaves whichever
  // accessor came last under that name. Asking each candidate for its owner
  // directly means the answer never depends on which one that was.
  for (const symbol_id of scope_symbols.values()) {
    const definition = definitions.get(symbol_id);
    if (definition?.kind !== "method") {
      continue;
    }
    const owner = definitions.get_member_owner(symbol_id);
    if (owner) {
      return owner;
    }
  }

  return null;
}
