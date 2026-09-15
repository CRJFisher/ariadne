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
 *    (`-> type[X]`), an instance for a declared return type, and an instance of
 *    the class a class-object binding holds (`p = cls()`).
 * 3. **Qualified member read** — `member_source` holds what the member holds.
 * 4. **Local carriers** — a variable's name initialiser, a class attribute's
 *    name or member-read initialiser, a parameter's default.
 *
 * A carrier never crosses a function boundary: a class handed in as an argument
 * (Django's `form_class(**defaults)`) needs interprocedural dataflow, and holds
 * nothing here.
 */

import type {
  AnyDefinition,
  Location,
  ScopeId,
  SymbolId,
  SymbolName,
  VariableDefinition,
} from "@ariadnejs/types";
import { resolve_element_type } from "./container_element";
import { dereference_named_import } from "./namespace_member";
import { resolve_chain_binding, type ReceiverResolutionContext } from "./receiver_resolution";
import type { DefinitionRegistry } from "../registries/definition";

export type ValueSource =
  | { readonly kind: "instance_of"; readonly type_id: SymbolId }
  | { readonly kind: "class_object"; readonly class_id: SymbolId }
  | { readonly kind: "callable"; readonly symbol_id: SymbolId };

/** An initialiser or default that reads one name as a whole (`Mapper`). */
const NAME_READ = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * An initialiser or default that reads one name, or one member of one name, as
 * a whole (`Mapper`, `feedgenerator.DefaultFeed`).
 */
const MEMBER_READ = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)?$/;

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
): ValueSource | undefined {
  const reaching = read_at ? reaching_binding(binding_id, read_at, context.definitions) : binding_id;
  return reaching ? binding_value(reaching, context, visited) : undefined;
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
): ValueSource | undefined {
  const symbol_id = resolve_chain_binding(chain, scope_id, context, visited);
  if (!symbol_id) {
    return undefined;
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
      return undefined;
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
): ValueSource | undefined {
  if (visited.has(binding_id)) {
    return undefined;
  }
  visited.add(binding_id);

  const def: AnyDefinition | undefined = context.definitions.get(binding_id);
  switch (def?.kind) {
    case "variable":
    case "constant":
      return (
        element_value(def, context, visited) ??
        callee_return_value(def, context, visited) ??
        member_read_value(def, context, visited) ??
        carrier_value(def.initial_value, NAME_READ, def, context, visited)
      );
    case "property":
      return carrier_value(def.initial_value, MEMBER_READ, def, context, visited);
    case "parameter":
      return carrier_value(def.default_value, MEMBER_READ, def, context, visited);
    default:
      return undefined;
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
): ValueSource | undefined {
  let element_id: SymbolId | null = null;
  if (binding.iterated_from) {
    const container_id = resolve_chain_binding(
      binding.iterated_from.container,
      binding.defining_scope_id,
      context,
      visited
    );
    element_id = container_id
      ? resolve_element_type(container_id, binding.iterated_from.yields, context)
      : null;
  } else if (binding.collection_source) {
    const container_id = context.resolutions.resolve(binding.defining_scope_id, binding.collection_source);
    element_id = container_id ? resolve_element_type(container_id, "index", context) : null;
  }
  return element_id ? { kind: "instance_of", type_id: element_id } : undefined;
}

/**
 * Producer 2: what calling the callee a binding's initialiser calls yields —
 * once for `p = parser(io)`, twice for `p = make()(io)`.
 */
function callee_return_value(
  binding: VariableDefinition,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | undefined {
  const callee_chain = binding.initialized_from_call ?? binding.initialized_from_call_result;
  if (!callee_chain) {
    return undefined;
  }
  const callee = resolve_read_value(callee_chain, binding.defining_scope_id, binding.location, context, visited);
  const result = callee ? call_result(callee, context) : undefined;
  return result && binding.initialized_from_call_result ? call_result(result, context) : result;
}

/**
 * What calling `callee` yields: an instance of the class a class object
 * constructs, or what a callable's declared return annotation names. Calling an
 * instance runs its `__call__`, whose result this does not follow.
 */
function call_result(callee: ValueSource, context: ReceiverResolutionContext): ValueSource | undefined {
  switch (callee.kind) {
    case "class_object":
      return { kind: "instance_of", type_id: callee.class_id };
    case "callable": {
      const class_id = context.types.get_callable_return_class(callee.symbol_id);
      if (class_id) {
        return { kind: "class_object", class_id };
      }
      const type_id = context.types.get_callable_return_type(callee.symbol_id);
      return type_id ? { kind: "instance_of", type_id } : undefined;
    }
    case "instance_of":
      return undefined;
  }
}

/** Producer 3: what the member a binding's `holder.member` initialiser reads holds. */
function member_read_value(
  binding: VariableDefinition,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | undefined {
  if (!binding.member_source) {
    return undefined;
  }
  const { holder, member } = binding.member_source;
  return resolve_read_value([holder, member], binding.defining_scope_id, binding.location, context, visited);
}

/**
 * Producer 4: what a carrier's initialiser or default holds, when that text is a
 * whole name read — `mapper_cls = Mapper`, `feed_type = feedgenerator.DefaultFeed`,
 * `def trace(Info=TraceInfo)`. A call, a literal or an expression holds nothing
 * here: each is another producer's to answer, or no one's.
 *
 * A variable's member read is `member_source`'s, which the indexer records
 * structurally, so only its one-name reads come from the text. A class attribute
 * and a parameter default carry no such field, so their member reads do.
 */
function carrier_value(
  value_text: string | undefined,
  read_shape: RegExp,
  carrier: AnyDefinition,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | undefined {
  if (value_text === undefined || !read_shape.test(value_text)) {
    return undefined;
  }
  return resolve_read_value(
    value_text.split(".") as SymbolName[],
    carrier.defining_scope_id,
    carrier.location,
    context,
    visited
  );
}
