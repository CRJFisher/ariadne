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
 *   - A `get(k)` hop, or an index read ending the receiver, takes one element
 *     of the container binding it reads (container_element.ts)
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
  VariableDefinition,
  AnyDefinition,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import { resolve_element_type } from "./container_element";
import { dereference_named_import, resolve_namespace_member } from "./namespace_member";
import {
  infer_generic_return,
  resolve_type_parameter_annotation,
} from "./type_parameter_resolution";
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
  /**
   * Present when the receiver is one element read out of the container that
   * `base` and `chain` name (`suites[0].m()`), with whether the key is a
   * literal. A string key is written into `chain` as its last segment; a
   * numeric key is not.
   */
  readonly index_access?: { readonly key_is_literal: boolean };
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

/**
 * The type a receiver through a binding takes from the value the binding holds
 * (`mapper_cls = Mapper; mapper_cls.create()`), or null. What a binding holds is
 * `value_source.ts`'s answer, which resolves name chains through this file, so
 * the caller hands it in rather than this file importing it back.
 *
 * @param visited - The bindings already being typed on this resolution.
 */
export type HeldValueType = (
  binding_id: SymbolId,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
) => SymbolId | null;

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
      ...(ref.index_access !== undefined && { index_access: ref.index_access }),
    };
  }

  const syntax = ref.call_site_syntax;
  const index_access =
    syntax?.receiver_kind === "index_access"
      ? { key_is_literal: syntax.index_key_is_literal === true }
      : undefined;

  const first_element = chain[0] as string;
  if (SELF_REFERENCE_KEYWORDS.has(first_element)) {
    return {
      base: { type: "keyword", value: first_element as SelfReferenceKeyword },
      chain: chain.slice(1, -1) as SymbolName[],
      method_name: ref.name,
      scope_id: ref.scope_id,
      ...(index_access !== undefined && { index_access }),
    };
  }

  const chain_arguments = ref.property_chain_arguments?.slice(1, -1);

  return {
    base: { type: "identifier", value: chain[0] as SymbolName },
    chain: chain.slice(1, -1) as SymbolName[],
    ...(chain_arguments !== undefined && { chain_arguments }),
    method_name: ref.name,
    scope_id: ref.scope_id,
    ...(index_access !== undefined && { index_access }),
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
  context: ReceiverResolutionContext,
  held_type: HeldValueType
): Result<SymbolId, ResolutionFailure> {
  return resolve_receiver_expression_type(receiver, context, new Set(), held_type);
}

/**
 * `resolve_receiver_type` carrying the bindings already being typed on this
 * resolution, so a binding whose container chain starts at itself
 * (`for (const node of node.children)`) stops rather than recurring.
 */
function resolve_receiver_expression_type(
  receiver: ReceiverExpression,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>,
  held_type: HeldValueType
): Result<SymbolId, ResolutionFailure> {
  if (receiver.index_access) {
    return resolve_index_receiver_type(receiver, receiver.index_access.key_is_literal, context, visited, held_type);
  }

  // A `get(k)` straight off an identifier reads one element of the container it
  // names, whose own type may be nothing the project declares (`Map`).
  if (receiver.base.type === "identifier" && is_element_get(receiver.chain, receiver.chain_arguments, 0)) {
    const container_id = context.resolutions.resolve(receiver.scope_id, receiver.base.value);
    const element_id = container_id ? resolve_element_type(container_id, "index", context) : null;
    if (element_id) {
      return walk_property_chain(
        element_id,
        null,
        receiver.chain.slice(1),
        receiver.chain_arguments?.slice(1),
        receiver.scope_id,
        context
      );
    }
  }

  const base_result = resolve_base(receiver.base, receiver.scope_id, context, visited, held_type);
  if (!base_result.ok) {
    return base_result;
  }

  if (receiver.chain.length === 0) {
    return base_result;
  }

  return walk_property_chain(
    base_result.value,
    receiver.base.type === "identifier"
      ? context.resolutions.resolve(receiver.scope_id, receiver.base.value)
      : null,
    receiver.chain,
    receiver.chain_arguments,
    receiver.scope_id,
    context
  );
}

/**
 * The type of an element read out of the container a receiver names
 * (`suites[0].m()`). A non-literal key is left unresolved: the receiver is
 * the element, never the container, so it is not walked as `suites.m()`.
 *
 * `call_site_syntax` does not say whether the key was a string, which the
 * chain keeps as its last segment, or a number, which it drops. The container
 * is therefore the whole chain, or — when that names no container — the chain
 * without the segment a string key wrote.
 */
function resolve_index_receiver_type(
  receiver: ReceiverExpression,
  key_is_literal: boolean,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>,
  held_type: HeldValueType
): Result<SymbolId, ResolutionFailure> {
  const names: readonly SymbolName[] = [receiver.base.value as SymbolName, ...receiver.chain];
  const candidates = key_is_literal
    ? receiver.chain.length > 0
      ? [names, names.slice(0, -1)]
      : [names]
    : [];
  for (const container_chain of candidates) {
    const container_id = resolve_chain_binding(container_chain, receiver.scope_id, context, visited, held_type);
    const element_id = container_id ? resolve_element_type(container_id, "index", context) : null;
    if (element_id) {
      return ok(element_id);
    }
  }
  return err({
    stage: "type_inference",
    reason: "receiver_type_unknown",
    partial_info: { last_known_scope: receiver.scope_id },
  });
}

/**
 * The definition a name chain denotes: the name itself for one segment,
 * otherwise the member the last segment names on the type the rest resolves
 * to (`this._instances`, `self.layers`, `loops.synloop`).
 *
 * A lone name is looked up lexically even when it spells a self receiver: a
 * name in value position is whatever its scope binds, so `cls = Parser` binds
 * `cls` like any other local.
 */
export function resolve_chain_binding(
  chain: readonly SymbolName[],
  scope_id: ScopeId,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>,
  held_type: HeldValueType
): SymbolId | null {
  const [root, ...members] = chain;
  const member_name = members[members.length - 1];
  if (member_name === undefined) {
    return context.resolutions.resolve(scope_id, root);
  }

  const holder = resolve_receiver_expression_type(
    {
      base: SELF_REFERENCE_KEYWORDS.has(root)
        ? { type: "keyword", value: root as SelfReferenceKeyword }
        : { type: "identifier", value: root },
      chain: members.slice(0, -1),
      method_name: member_name,
      scope_id,
    },
    context,
    visited,
    held_type
  );
  return holder.ok ? find_member_symbol(holder.value, member_name, context) : null;
}

/**
 * Whether chain position `index` is a `get(k)` call — a keyed read of the
 * container before it. Chain arguments are recorded only when some position
 * passes an identifier, so a `get` with none recorded is taken as the call.
 */
function is_element_get(
  chain: readonly SymbolName[],
  chain_arguments: ChainCallArguments | undefined,
  index: number
): boolean {
  return chain[index] === "get" && chain_arguments?.[index] !== null;
}

/**
 * Resolve the base of a receiver expression to a type
 */
function resolve_base(
  base: ReceiverExpression["base"],
  scope_id: ScopeId,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>,
  held_type: HeldValueType
): Result<SymbolId, ResolutionFailure> {
  if (base.type === "keyword") {
    return resolve_keyword_base(base.value, scope_id, context);
  } else {
    return resolve_identifier_base(base.value, scope_id, context, visited, held_type);
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
  visited: Set<SymbolId>,
  held_type: HeldValueType
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
      // from, so it is consulted after it.
      (def.kind === "variable" || def.kind === "constant") &&
      def.destructured_from !== undefined &&
      def.destructured_key !== undefined
    ) {
      type_id = resolve_destructured_property_type(
        def,
        def.destructured_from,
        def.destructured_key,
        context,
        visited,
        held_type
      );
    }
  }

  if (!type_id && def) {
    // An annotation naming a type parameter (`v: &mut V`) resolved to nothing
    // when the file was indexed, because `V` denotes no type on its own. What
    // the declaration bounds it to is the type its members are reached through.
    type_id = resolve_type_parameter_annotation(def, context);
  }

  if (!type_id) {
    // What the binding holds, last.
    type_id = held_type(symbol_id, context, visited);
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
 * The member `property_name` names on `type_id`: through the TypeRegistry's
 * resolved members and inheritance, then the member index, which catches
 * members the TypeRegistry has not resolved a type for, then a namespace's own
 * members — a TypeScript `namespace` block holds them in its own scope, and a
 * namespace import in the module it points at.
 */
function find_member_symbol(
  type_id: SymbolId,
  property_name: SymbolName,
  context: ReceiverResolutionContext
): SymbolId | null {
  return (
    context.types.get_type_member(type_id, property_name) ??
    context.definitions.get_member_index().get(type_id)?.get(property_name) ??
    resolve_namespace_member(type_id, property_name, context)
  );
}

/**
 * Walk a property chain, resolving each property to its member's type so the next
 * property is looked up on that type, and returning the final type.
 */
function walk_property_chain(
  start_type: SymbolId,
  start_binding: SymbolId | null,
  chain: readonly SymbolName[],
  chain_arguments: ChainCallArguments | undefined,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): Result<SymbolId, ResolutionFailure> {
  let current_type = start_type;
  // The binding whose declared annotation described `current_type`, which is
  // what a generic member reads its owner's type arguments from.
  let current_binding = start_binding;

  for (let index = 0; index < chain.length; index++) {
    const property_name = chain[index];
    const member_symbol = find_member_symbol(current_type, property_name, context);

    if (!member_symbol) {
      return err({
        stage: "receiver_resolution",
        reason: "method_not_on_type",
        partial_info: { resolved_receiver_type: current_type },
      });
    }

    // `this.contributions.get(k)` reads one element of the container member,
    // whatever the container's own type.
    const element_id = is_element_get(chain, chain_arguments, index + 1)
      ? resolve_element_type(member_symbol, "index", context)
      : null;
    if (element_id) {
      current_type = element_id;
      // The element is the container's, not what the container binding
      // declares, so no binding describes the type the walk continues on.
      current_binding = null;
      index++;
      continue;
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
          // A generic method whose return names a type parameter (get<T>(): T)
          // has no resolvable return type until that parameter is bound. What
          // binds it is this call's arguments, the receiver's own declared
          // instantiation, or the parameter's declared bound.
          member_type = infer_generic_return(
            member_def,
            current_binding,
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
    current_binding = member_symbol;
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
  visited: Set<SymbolId>,
  held_type: HeldValueType
): SymbolId | null {
  if (visited.has(binding.symbol_id)) {
    return null;
  }
  visited.add(binding.symbol_id);

  const source_type = resolve_identifier_base(
    source,
    binding.defining_scope_id,
    context,
    visited,
    held_type
  );
  if (!source_type.ok) {
    return null;
  }

  const property_type = walk_property_chain(
    source_type.value,
    null,
    [key],
    undefined,
    binding.defining_scope_id,
    context
  );
  return property_type.ok ? property_type.value : null;
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
