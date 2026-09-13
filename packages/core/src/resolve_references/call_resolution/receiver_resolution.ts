/**
 * Receiver Resolution Module
 *
 * Resolves receiver expressions to their types for method call resolution.
 * This module unifies the handling of both self-reference calls (this.method())
 * and regular method calls (obj.method()) through a two-phase approach:
 *
 * Phase 1: Resolve the base of the receiver expression
 *   - Self-reference keywords (this, self, super, cls) → the type the enclosing
 *     scope names as its self type
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
  LexicalScope,
  SelfReferenceCall,
  MethodCallReference,
  SelfReferenceKeyword,
  ChainCallArguments,
  MethodDefinition,
  VariableDefinition,
  AnyDefinition,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import { resolve_module_member } from "../module_member_lookup";
import { parse_type_annotation, type ParsedTypeAnnotation } from "../type_preprocessing";
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
 * Registries needed to name the type a self receiver denotes: the scope tree
 * that records the name, the resolver that binds it, and the import surface a
 * name declared in another file is reached through.
 *
 * Narrower than `ReceiverResolutionContext` so the Rust path resolver, which
 * carries no `TypeRegistry`, can resolve `Self` through the same walk.
 */
export interface SelfTypeResolutionContext {
  readonly scopes: ScopeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly imports: ImportGraph;
  readonly exports: ExportRegistry;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly modules: ModuleResolutionContext;
}

/**
 * Registries needed to infer the type of a receiver expression and look up
 * methods on that type (phases 1 and 2 of receiver resolution).
 */
export interface ReceiverResolutionContext extends SelfTypeResolutionContext {
  readonly types: TypeRegistry;
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
  const self_type = find_self_type(scope_id, context);

  if (!self_type.ok) {
    // Object-literal methods and prototype/member-assigned functions sit in no
    // scope that names a type. Bind `this`/self to the function collection
    // holding them so `this.method()` resolves against its siblings. `super`
    // takes no such binding — a collection has no parent to dispatch against.
    if (keyword !== "super") {
      const collection_id = find_enclosing_function_collection(scope_id, context);
      if (collection_id) {
        return ok(collection_id);
      }
    }

    return self_type;
  }

  // super dispatches against the parent class; index 0 is the current class.
  if (keyword === "super") {
    const inheritance_chain = context.types.walk_inheritance_chain(self_type.value);
    if (inheritance_chain.length < 2) {
      return err({
        stage: "receiver_resolution",
        reason: "no_parent_class",
        partial_info: { resolved_receiver_type: self_type.value },
      });
    }
    return ok(inheritance_chain[1]);
  }

  return self_type;
}

/**
 * The function collection a `this` with no enclosing type denotes: either the
 * collection whose member body encloses the call, or — when the call sits in
 * the holder's own body rather than in one of its members — the collection the
 * enclosing function itself carries.
 *
 * The second shape is a constructor function assembled by prototype assignment
 * (express's `function View() { this.lookup() }` with `View.prototype.lookup =
 * fn`): the members are folded onto the holder, but none of them spans the
 * holder's body, so the member scan alone misses it.
 */
function find_enclosing_function_collection(
  scope_id: ScopeId,
  context: SelfTypeResolutionContext
): SymbolId | null {
  const scope = context.scopes.get_scope(scope_id);
  if (!scope) {
    return null;
  }

  const member_holder = context.definitions.find_enclosing_collection(scope.location);
  if (member_holder) {
    return member_holder;
  }

  for (
    let current: LexicalScope | undefined = scope;
    current;
    current = current.parent_id
      ? context.scopes.get_scope(current.parent_id)
      : undefined
  ) {
    if (current.type !== "function" || !current.name) {
      continue;
    }
    const holder_id = context.resolutions.resolve(current.id, current.name);
    if (holder_id && context.definitions.get_function_collection(holder_id)) {
      return holder_id;
    }
  }

  return null;
}

/**
 * Resolve an identifier receiver to a type SymbolId.
 */
function resolve_identifier_base(
  identifier: SymbolName,
  scope_id: ScopeId,
  context: ReceiverResolutionContext,
  visited?: Set<SymbolId>
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

  let type_id = def ? recorded_hop_type(def, context) : null;

  if (!type_id && def) {
    // A type used as a receiver (Type.staticMethod(), Type::associated_function())
    // is its own type. A declared annotation is not re-read here: the
    // TypeRegistry resolved it when the file was indexed, and a miss there is
    // a miss here.
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
      // The rung above states a type; this one only says where the value came
      // from, so it is consulted last.
      (def.kind === "variable" || def.kind === "constant") &&
      def.destructured_from !== undefined &&
      def.destructured_key !== undefined
    ) {
      type_id = resolve_destructured_property_type(
        def,
        def.destructured_from,
        def.destructured_key,
        context,
        visited ?? new Set()
      );
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
    return resolve_module_member(
      source_file,
      property_name,
      "namespace",
      context.exports,
      context.definitions,
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
  context: SelfTypeResolutionContext
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
 * The type the TypeRegistry recorded for a receiver hop through `def`. A hop
 * through a function or method continues on what calling it yields —
 * `e.connect().exec()` looks `exec` up on `connect`'s return type — so it reads
 * the declared return type; a hop through anything else continues on the value
 * it holds.
 */
function recorded_hop_type(
  def: AnyDefinition,
  context: ReceiverResolutionContext
): SymbolId | null {
  return def.kind === "function" || def.kind === "method"
    ? context.types.get_callable_return_type(def.symbol_id)
    : context.types.get_symbol_type(def.symbol_id);
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

    const member_def = context.definitions.get(member_symbol);
    let member_type = member_def ? recorded_hop_type(member_def, context) : null;

    if (!member_type) {
      // The member index gives a callable the name it shares with a field —
      // Rust's `struct Buf { data: Inner }` beside `fn data(&self)` — because
      // the call position needs the method. A chain position that is not
      // itself a call is a value, so where the callable yields no type the
      // chain continues through the declared field's recorded type. The
      // field is looked up on the type that supplied the member, which
      // inheritance may put above the receiver.
      if (
        (member_def?.kind === "method" || member_def?.kind === "constructor") &&
        chain_arguments?.[index] == null
      ) {
        const declaring_type =
          context.definitions.get_member_owner(member_symbol) ?? current_type;
        const owner = context.definitions.get(declaring_type);
        const field =
          owner?.kind === "class" || owner?.kind === "interface"
            ? owner.properties.find((property) => property.name === property_name)
            : undefined;
        if (field) {
          member_type = context.types.get_symbol_type(field.symbol_id);
        }
      }

      if (!member_type && member_def) {
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

/**
 * Resolve a destructured binding to the type of the property it unpacks:
 * `const { storage } = options` types `storage` as whatever the source's
 * type declares for `storage`.
 *
 * The source is resolved as a receiver in its own right, so a chain of
 * destructurings resolves one hop at a time by the same member walk a written
 * `options.storage` takes. `visited` holds the bindings already on that
 * chain, so a binding that destructures itself — directly or mutually — stops
 * rather than recurring.
 *
 * Returns null when the source has no known type or carries no such member:
 * the receiver that failed is the binding, so the caller's own
 * `receiver_type_unknown` is the honest failure and is left in place.
 */
function resolve_destructured_property_type(
  binding: VariableDefinition,
  source: SymbolName,
  key: SymbolName,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): SymbolId | null {
  if (visited.has(binding.symbol_id)) {
    return null;
  }
  visited.add(binding.symbol_id);

  const source_type = resolve_identifier_base(
    source,
    binding.defining_scope_id,
    context,
    visited
  );
  if (!source_type.ok) {
    return null;
  }

  const property_type = walk_property_chain(
    source_type.value,
    [key],
    undefined,
    binding.defining_scope_id,
    context
  );
  return property_type.ok ? property_type.value : null;
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
  const language = context.languages.get(method_def.location.file_path);
  if (!language) {
    return null;
  }

  // The token parameter is the one whose declared type wraps the return-type
  // parameter exactly (token: Type<T> for a method returning T).
  const token_index = method_def.parameters.findIndex(
    (param) =>
      param.type !== undefined &&
      is_type_token_for(parse_type_annotation(param.type, language), return_type)
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
 * Whether a parameter annotation is a token designating `type_parameter`: a
 * single-argument generic wrapping exactly that parameter (`Type<T>`). An
 * array of `T` (`T[]`, `Array<T>`) holds values of `T` and designates nothing.
 */
function is_type_token_for(
  annotation: ParsedTypeAnnotation | null,
  type_parameter: SymbolName
): boolean {
  if (!annotation || annotation.arguments.length !== 1) {
    return false;
  }
  if (annotation.head.length === 1 && annotation.head[0] === "Array") {
    return false;
  }
  const [wrapped] = annotation.arguments;
  return (
    wrapped.head.length === 1 &&
    wrapped.head[0] === type_parameter &&
    wrapped.arguments.length === 0
  );
}

// @language typescript
/**
 * Resolve a type-token argument to the class it designates: a class/type used
 * directly (`injector.get(Service)`) is its own type; a typed token binding
 * (a parameter `token: Type<Service>`) designates the single type argument its
 * annotation resolved to.
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

  const type_arguments = context.types.get_symbol_type_arguments(symbol_id);
  return type_arguments.length === 1 ? type_arguments[0] : null;
}

/**
 * The type a `self`/`this`/`cls`/`Self` receiver in `scope_id` denotes.
 *
 * Each scope that binds a self receiver records the type it binds it to
 * (`LexicalScope.self_type_name`), so the type is read off the scope tree as a
 * declared fact rather than inferred from the members the scope happens to
 * hold. That is what makes a body with no members of its own — a
 * constructor-only class, a cross-file Rust `impl` — name its type, and what
 * keeps the answer independent of which member of a same-named pair the
 * name-keyed indexes kept.
 *
 * The walk stops at the FIRST scope carrying a name: a nested class binds
 * `self` to itself, and continuing to an enclosing type would bind it to the
 * wrong one.
 */
export function find_self_type(
  scope_id: ScopeId,
  context: SelfTypeResolutionContext
): Result<SymbolId, ResolutionFailure> {
  for (
    let scope = context.scopes.get_scope(scope_id);
    scope;
    scope = scope.parent_id ? context.scopes.get_scope(scope.parent_id) : undefined
  ) {
    const self_type_name = scope.self_type_name;
    if (!self_type_name) {
      continue;
    }

    // A type is declared outside the body that records its name, so the lookup
    // starts one scope out: a member named after its own class (`class Foo { Foo
    // = 5 }`, a Python class attribute) can only shadow the declaration, never
    // be it. Starting outside also reaches a Rust `impl`'s `use`, which sits in
    // the module scope above the block.
    const lookup_scope_id = scope.parent_id ?? scope.id;
    const symbol_id = resolve_self_type_name(
      self_type_name,
      lookup_scope_id,
      scope.location.file_path,
      context
    );

    if (symbol_id) {
      return ok(symbol_id);
    }

    return err({
      stage: "receiver_resolution",
      reason: "class_definition_not_found",
      partial_info: { last_known_scope: scope.id },
    });
  }

  return err({
    stage: "receiver_resolution",
    reason: "no_enclosing_class_scope",
    partial_info: { last_known_scope: scope_id },
  });
}

/**
 * The type `self_type_name` denotes when looked up from `lookup_scope_id`.
 *
 * The lexical binding answers first, so an imported type resolves through the
 * same chain every other name uses. A scope holds one symbol per name, though,
 * so a type declared beside a same-named non-type — a TypeScript `class Foo`
 * merged with a `namespace Foo` — can lose that slot; the type is then asked for
 * by kind, which a self receiver is entitled to do because only a type can be
 * what `self` denotes.
 */
function resolve_self_type_name(
  self_type_name: SymbolName,
  lookup_scope_id: ScopeId,
  file_id: FilePath,
  context: SelfTypeResolutionContext
): SymbolId | null {
  const resolved = context.resolutions.resolve(lookup_scope_id, self_type_name);
  const bound = resolved ? dereference_named_import(resolved, context) : null;
  const kind = bound ? context.definitions.get(bound)?.kind : undefined;

  if (bound && (kind === "class" || kind === "interface" || kind === "enum")) {
    return bound;
  }

  return context.definitions.find_type_declared_in_scope(
    file_id,
    lookup_scope_id,
    self_type_name
  );
}
