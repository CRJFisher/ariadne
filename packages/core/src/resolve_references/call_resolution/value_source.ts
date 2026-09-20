/**
 * What value a binding holds: an instance of a type, a class object, or a
 * callable.
 *
 * The `TypeRegistry` records the type a binding's annotation or construction
 * states, and call resolution records which definitions a call reaches. Neither
 * says what a binding holds when the value flows into it — `mapper_cls = Mapper`,
 * `parser = _parser_dispatch(flav)`, `orig = BaseTask.__call__`,
 * `var s = suites[0]` — so a receiver, a construction and a bare call through
 * such a binding each used to stop at the binding. This is the one answer all
 * of them read.
 *
 * A class object is kept apart from an instance of its class because calling
 * the two does different things: calling a class object constructs the class,
 * while calling an instance dispatches to its `__call__`.
 *
 * Producers, in priority order:
 *
 * 1. **Container element** — a binding a container read initialises
 *    (`collection_source`, `iterated_from`) holds one element.
 * 2. **Callee return** — a binding a call initialises holds what calling the
 *    callee yields: a class object for a declared class-object return
 *    (`-> type[X]`), an instance for a declared return type, an instance of the
 *    type a generic return stands for at this call (`create(Router)`), and an
 *    instance of the class a class-object binding holds (`p = cls()`).
 * 3. **Qualified member read** — a variable's or class attribute's initialiser,
 *    or a parameter's default, that reads one member of one name
 *    (`member_source`) holds what the member holds.
 * 4. **Local carriers** — one that reads one name (`name_source`) holds what
 *    the name holds.
 *
 * A carrier never crosses a function boundary: a class handed in as an argument
 * (Django's `form_class(**defaults)`) needs interprocedural dataflow, and holds
 * nothing here.
 */

import type {
  Location,
  ParameterDefinition,
  PropertyDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
  VariableDefinition,
} from "@ariadnejs/types";
import { resolve_element_type } from "./container_element";
import { dereference_named_import } from "./namespace_member";
import { resolve_chain_binding, type ReceiverResolutionContext } from "./receiver_resolution";
import { infer_generic_return } from "./type_parameter_resolution";
import type { DefinitionRegistry } from "../registries/definition";

export type ValueSource =
  | { readonly kind: "instance_of"; readonly type_id: SymbolId }
  | { readonly kind: "class_object"; readonly class_id: SymbolId }
  | { readonly kind: "callable"; readonly symbol_id: SymbolId };

/** A definition whose initialiser or default can carry a value into it. */
type Carrier = VariableDefinition | PropertyDefinition | ParameterDefinition;

/**
 * The value `binding_id` holds where it is read at `read_at`.
 *
 * A scope can bind one name several times (`mapper_cls = Mapper; mapper_cls();
 * mapper_cls = Other`), and name resolution holds only one of them. A read at a
 * known position takes the one binding that precedes it; where several do, the
 * later ones may sit under a condition, so the read holds nothing rather than a
 * guess. A read whose position is unknown (`null`) takes the binding name
 * resolution chose.
 *
 * @param visited - The bindings already being resolved on this path, shared with
 *   receiver resolution so a binding whose value leads back to itself stops.
 */
export function resolve_value_source(
  binding_id: SymbolId,
  read_at: Location | null,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId> = new Set()
): ValueSource | null {
  const reaching = read_at ? reaching_binding(binding_id, read_at, context.definitions) : binding_id;
  return reaching ? binding_value(reaching, context, visited) : null;
}

/**
 * The type a receiver through `binding_id` takes from what the binding holds: an
 * instance's type, or the class a class object is — a class object is its own
 * receiver type, just as a class named directly is (`cls.create()`). Receiver
 * resolution is handed this as its `HeldValueType`.
 */
export function resolve_held_type(
  binding_id: SymbolId,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): SymbolId | null {
  const held = resolve_value_source(binding_id, null, context, visited);
  switch (held?.kind) {
    case "instance_of":
      return held.type_id;
    case "class_object":
      return held.class_id;
    default:
      return null;
  }
}

/**
 * The value a name chain read in `scope_id` at `read_at` denotes: the binding,
 * class, callable or member it names, and for a binding what that binding holds.
 */
export function resolve_read_value(
  chain: readonly SymbolName[],
  scope_id: ScopeId,
  read_at: Location | null,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId> = new Set()
): ValueSource | null {
  const symbol_id = resolve_chain_binding(chain, scope_id, context, visited, resolve_held_type);
  if (!symbol_id) {
    return null;
  }
  const target = dereference_named_import(symbol_id, context);
  const def = target ? context.definitions.get(target) : undefined;
  switch (def?.kind) {
    case "class":
      return { kind: "class_object", class_id: def.symbol_id };
    case "function":
    case "method":
      return { kind: "callable", symbol_id: def.symbol_id };
    case "variable":
    case "constant":
    case "property":
    case "parameter":
      return resolve_value_source(def.symbol_id, chain.length === 1 ? read_at : null, context, visited);
    default:
      return null;
  }
}

/**
 * The one binding of `binding_id`'s name in its scope that precedes `read_at`,
 * or null when none or several do. A read from another file runs once the
 * binding's module has run to its end, so every binding precedes it.
 */
function reaching_binding(
  binding_id: SymbolId,
  read_at: Location,
  definitions: DefinitionRegistry
): SymbolId | null {
  const rebindings = definitions.get_scope_rebindings(binding_id);
  if (rebindings.length === 0) {
    return binding_id;
  }
  const preceding = rebindings.filter((symbol_id) => {
    const location = definitions.get(symbol_id)?.location;
    return (
      location !== undefined &&
      (location.file_path !== read_at.file_path ||
        location.start_line < read_at.start_line ||
        (location.start_line === read_at.start_line && location.start_column < read_at.start_column))
    );
  });
  return preceding.length === 1 ? preceding[0] : null;
}

function binding_value(
  binding_id: SymbolId,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  if (visited.has(binding_id)) {
    return null;
  }
  visited.add(binding_id);

  const def = context.definitions.get(binding_id);
  switch (def?.kind) {
    case "variable":
    case "constant":
      return (
        element_value(def, context, visited) ??
        callee_return_value(def, context, visited) ??
        member_read_value(def, context, visited) ??
        name_read_value(def, context, visited)
      );
    case "property":
    case "parameter":
      return member_read_value(def, context, visited) ?? name_read_value(def, context, visited);
    default:
      return null;
  }
}

/**
 * Producer 1: the element a binding a container read initialises holds — a loop
 * or array pattern over the container it iterates (`iterated_from`), or an index
 * or `get(k)` lookup of the collection it names (`collection_source`).
 */
function element_value(
  binding: VariableDefinition,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  let element_id: SymbolId | null = null;
  if (binding.iterated_from) {
    const container_id = resolve_chain_binding(
      binding.iterated_from.container,
      binding.defining_scope_id,
      context,
      visited,
      resolve_held_type
    );
    element_id = container_id
      ? resolve_element_type(container_id, binding.iterated_from.yields, context, resolve_held_type, visited)
      : null;
  } else if (binding.collection_source) {
    const container_id = context.resolutions.resolve(binding.defining_scope_id, binding.collection_source);
    element_id = container_id
      ? resolve_element_type(container_id, "index", context, resolve_held_type, visited)
      : null;
  }
  return element_id ? { kind: "instance_of", type_id: element_id } : null;
}

/**
 * Producer 2: what calling the callee a binding's initialiser calls yields —
 * once for `p = parser(io)`, twice for `p = make()(io)`.
 */
function callee_return_value(
  binding: VariableDefinition,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  // @language python
  // Only a Python initialiser records `initialized_from_call_result`, the inner
  // callee of `make()(io)`, whose result is called a second time.
  const callee_chain = binding.initialized_from_call ?? binding.initialized_from_call_result;
  if (!callee_chain) {
    return null;
  }
  const call: CallSite = {
    call_arguments: binding.initialized_from_call_arguments ?? null,
    scope_id: binding.defining_scope_id,
  };
  const callee = resolve_read_value(callee_chain, binding.defining_scope_id, binding.location, context, visited);
  const result = callee ? call_result(callee, call, context) : null;
  // @language python
  // The outer call of `make()(io)` records no arguments of its own, so only its
  // scope carries over to the second hop.
  return result && binding.initialized_from_call_result
    ? call_result(result, { call_arguments: null, scope_id: call.scope_id }, context)
    : result;
}

/** What one call says about the type its callee returns: its arguments, and where they resolve. */
interface CallSite {
  readonly call_arguments: readonly (SymbolName | null)[] | null;
  readonly scope_id: ScopeId;
}

/**
 * What calling `callee` yields: an instance of the class a class object
 * constructs, or what a callable's declared return annotation names — the type
 * the registry resolved for it, else the one a generic return stands for at
 * this call. Calling an instance runs its `__call__`, whose result this does
 * not follow.
 */
function call_result(
  callee: ValueSource,
  call: CallSite,
  context: ReceiverResolutionContext
): ValueSource | null {
  switch (callee.kind) {
    case "class_object":
      return { kind: "instance_of", type_id: callee.class_id };
    case "callable": {
      const class_id = context.types.get_callable_return_class(callee.symbol_id);
      if (class_id) {
        return { kind: "class_object", class_id };
      }
      const type_id =
        context.types.get_callable_return_type(callee.symbol_id) ??
        generic_return_type(callee.symbol_id, call, context);
      return type_id ? { kind: "instance_of", type_id } : null;
    }
    case "instance_of":
      return null;
  }
}

/**
 * The type a generic callable's return denotes for this one call —
 * `create<T>(token: Type<T>): T` called as `create(Router)` yields `Router`.
 * The registry records no return type for such a callable: what the parameter
 * is called is the declaration's business, and only the call's arguments and
 * the parameter's own bound say what it stands for here.
 */
function generic_return_type(
  callee_id: SymbolId,
  call: CallSite,
  context: ReceiverResolutionContext
): SymbolId | null {
  const callee = context.definitions.get(callee_id);
  if (callee?.kind !== "function" && callee?.kind !== "method") {
    return null;
  }
  return infer_generic_return(callee, null, call.call_arguments, call.scope_id, context);
}

/**
 * Producer 3: what the member a carrier's `holder.member` initialiser or default
 * reads holds — `orig = BaseTask.__call__`, `feed_type = feedgenerator.DefaultFeed`.
 */
function member_read_value(
  carrier: Carrier,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  if (!carrier.member_source) {
    return null;
  }
  const { holder, member } = carrier.member_source;
  return resolve_read_value([holder, member], carrier.defining_scope_id, carrier.location, context, visited);
}

/**
 * Producer 4: what the one name a carrier's initialiser or default reads holds —
 * `mapper_cls = Mapper`, `def trace(Info=TraceInfo)`. A call, a literal or an
 * expression holds nothing here: each is another producer's to answer, or no
 * one's.
 */
function name_read_value(
  carrier: Carrier,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  if (!carrier.name_source) {
    return null;
  }
  return resolve_read_value([carrier.name_source], carrier.defining_scope_id, carrier.location, context, visited);
}
