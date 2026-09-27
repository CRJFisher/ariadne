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
 *    the name holds; a self receiver read as a value (`var self = this`) holds
 *    what the receiver denotes.
 * 5. **Carried arguments** — a parameter every resolved call site hands the
 *    same class holds that class object (`build(MyForm)` against
 *    `def build(cls, **kw)`).
 * 6. **Callback parameters** — a parameter of a callback passed as an argument
 *    holds an instance of what the callee's function-typed parameter hands it
 *    at that position (`self.with_res(r, |this| …)` against
 *    `f: impl FnOnce(&mut Self) -> T`).
 *
 * Two of these cross a call edge, one in each direction, and both are one hop.
 * A binding a call initialises takes the name chain the callee returns where no
 * annotation states a type (`form_class = self.get_form_class()` against
 * `def get_form_class(self): return self.form_class`), so a class reaches the
 * caller that constructs it. A parameter takes the class its call sites hand
 * it, so a class reaches the factory that constructs it. Neither unions: a
 * callee whose returns disagree records no chain, and a parameter reached from
 * two classes answers nothing, so a missing edge is never replaced by a wrong
 * one.
 */

import type {
  FunctionCallReference,
  Language,
  Location,
  MethodCallReference,
  MethodDefinition,
  FunctionDefinition,
  SelfReferenceCall,
  ParameterDefinition,
  PropertyDefinition,
  ScopeId,
  SelfReferenceKeyword,
  SymbolId,
  SymbolName,
  VariableDefinition,
} from "@ariadnejs/types";
import { resolve_element_type } from "./container_element";
import { dereference_named_import } from "./namespace_member";
import {
  read_self_reference,
  resolve_chain_binding,
  resolve_keyword_base,
  type ReceiverResolutionContext,
} from "./receiver_resolution";
import { infer_generic_return } from "./type_parameter_resolution";
import type { DefinitionRegistry } from "../registries/definition";
import { resolve_annotation_in_environment } from "../type_parameter_environment";
import { lookup_annotation } from "../type_annotation_lookup";
import {
  callable_parameter_annotations,
  parse_type_annotation,
  type ParsedTypeAnnotation,
} from "../type_preprocessing";
import { resolve_qualified_path_rust } from "./path_resolution.rust";

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
  const keyword = chain.length === 1 ? read_self_reference(chain[0], scope_id, context) : null;
  if (keyword) {
    return self_reference_value(keyword, scope_id, context);
  }
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
 * What a self receiver read as a value holds — `var self = this` captures an
 * instance of the enclosing type, Python's `cls` is the class object itself.
 * A bare `super` is no receiver: JavaScript cannot read it as a value, and
 * Python's is the builtin, which reaches the parent only when called.
 */
function self_reference_value(
  keyword: SelfReferenceKeyword,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): ValueSource | null {
  if (keyword === "super") {
    return null;
  }
  const type_id = resolve_keyword_base(keyword, scope_id, context);
  if (!type_id.ok) {
    return null;
  }
  return keyword === "cls"
    ? { kind: "class_object", class_id: type_id.value }
    : { kind: "instance_of", type_id: type_id.value };
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
      return member_read_value(def, context, visited) ?? name_read_value(def, context, visited);
    case "parameter":
      return (
        member_read_value(def, context, visited) ??
        name_read_value(def, context, visited) ??
        carried_argument_value(def, context) ??
        callback_parameter_value(def, context, visited)
      );
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
  const result = callee ? call_result(callee, call, context, visited) : null;
  // @language python
  // The outer call of `make()(io)` records no arguments of its own, so only its
  // scope carries over to the second hop.
  return result && binding.initialized_from_call_result
    ? call_result(result, { call_arguments: null, scope_id: call.scope_id }, context, visited)
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
 * this call, else what the name chain its body returns holds. Calling an
 * instance runs its `__call__`, whose result this does not follow.
 */
function call_result(
  callee: ValueSource,
  call: CallSite,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
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
      return type_id
        ? { kind: "instance_of", type_id }
        : returned_chain_value(callee.symbol_id, context, visited);
    }
    case "instance_of":
      return null;
  }
}

/**
 * What the name chain `callee_id`'s body returns holds, read where the body
 * reads it. A declaration that states its return type has already answered, so
 * this is what types a binding initialised by an accessor written without one —
 * `form_class = self.get_form_class()` against `def get_form_class(self):
 * return self.form_class`.
 */
function returned_chain_value(
  callee_id: SymbolId,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  const callee = context.definitions.get(callee_id);
  if (callee?.kind !== "function" && callee?.kind !== "method") {
    return null;
  }
  const { returned_name_chain, body_scope_id } = callee;
  if (!returned_name_chain || !body_scope_id) {
    return null;
  }
  return resolve_read_value(returned_name_chain, body_scope_id, null, context, visited);
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
 * Producer 5: the class object a parameter holds because every resolved call
 * site of the callable declaring it hands that same class to its position —
 * `build(MyForm)` typing `cls` inside `def build(cls, **kw)`.
 *
 * The evidence is written by the callers and read here, in the callee's own
 * body, which is why a change to a call site re-answers the declaring file
 * rather than the calling one. A function only: a method's declared positions
 * lead with its receiver, which no argument list binds, so the evidence names
 * none of them.
 */
function carried_argument_value(
  parameter: ParameterDefinition,
  context: ReceiverResolutionContext
): ValueSource | null {
  if (!context.scopes.get_scope(parameter.defining_scope_id)) {
    return null;
  }
  const body_scope = context.scopes.find_enclosing_function_scope(parameter.defining_scope_id);
  const callable_id = context.definitions.get_callable_of_body_scope(body_scope);
  const callable = callable_id ? context.definitions.get(callable_id) : undefined;
  if (!callable_id || callable?.kind !== "function") {
    return null;
  }

  const position = callable.signature.parameters.findIndex(
    (declared) => declared.symbol_id === parameter.symbol_id
  );
  if (position < 0) {
    return null;
  }

  const class_id = context.resolutions.get_carried_class(callable_id, position);
  return class_id ? { kind: "class_object", class_id } : null;
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

/** A call a callback can be passed to, whose callee declares what the callback receives. */
type ReceivingCall = FunctionCallReference | MethodCallReference | SelfReferenceCall;

/**
 * Producer 6: the instance a callback's parameter receives from the callee it
 * is passed to — `this` in `self.with_res(r, |this| this.parse())` against
 * `fn with_res<T>(&mut self, r: Restrictions, f: impl FnOnce(&mut Self) -> T)`.
 *
 * The callee's declaration says what it hands the callback, as a function type
 * at the callback's argument position, read positionally against the
 * callback's own parameters. A parameter that declares its own annotation is
 * the `TypeRegistry`'s to type, and one the callee declares nothing for holds
 * nothing.
 */
function callback_parameter_value(
  parameter: ParameterDefinition,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): ValueSource | null {
  if (parameter.type !== undefined || !context.scopes.get_scope(parameter.defining_scope_id)) {
    return null;
  }
  const body_scope = context.scopes.find_enclosing_function_scope(parameter.defining_scope_id);
  const callback_id = context.definitions.get_callable_of_body_scope(body_scope);
  const callback = callback_id ? context.definitions.get(callback_id) : undefined;
  const passed = callback?.kind === "function" ? callback.callback_context : undefined;
  if (callback?.kind !== "function" || !passed?.receiver_location || passed.argument_index === null) {
    return null;
  }
  const position = callback.signature.parameters.findIndex((declared) => declared.symbol_id === parameter.symbol_id);
  const call = receiving_call(passed.receiver_location, context);
  const callee = call ? call_target(call, context, visited) : null;
  if (!call || !callee || position < 0) {
    return null;
  }

  const language = context.languages.get(callee.location.file_path);
  const declared = callee.kind === "function" ? callee.signature.parameters : callee.parameters;
  const offset = receiver_offset(callee, declared, call, language, context, visited);
  const function_type = declared[passed.argument_index + offset]?.type;
  if (!language || function_type === undefined) {
    return null;
  }
  const bound = callee.generics?.find((generic) => generic.name === function_type)?.bound;
  const handed = callable_parameter_annotations(bound ?? function_type, language)?.[position];
  const type_id = handed ? handed_type(handed, callee, declared.slice(offset), call, language, context) : null;
  return type_id ? { kind: "instance_of", type_id } : null;
}

/** The call written at `location` that a callback can be passed to. */
function receiving_call(location: Location, context: ReceiverResolutionContext): ReceivingCall | null {
  for (const ref of context.references.get_file_references(location.file_path)) {
    if (
      (ref.kind === "function_call" || ref.kind === "method_call" || ref.kind === "self_reference_call") &&
      ref.location.start_line === location.start_line &&
      ref.location.start_column === location.start_column
    ) {
      return ref;
    }
  }
  return null;
}

/** The function or method `call` reaches through the name chain it is written with. */
function call_target(
  call: ReceivingCall,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): FunctionDefinition | MethodDefinition | null {
  const chain = callee_chain(call);
  const callee = resolve_read_value(chain, call.scope_id, null, context, visited);
  const def = callee?.kind === "callable" ? context.definitions.get(callee.symbol_id) : undefined;
  return def?.kind === "function" || def?.kind === "method" ? def : null;
}

function callee_chain(call: ReceivingCall): readonly SymbolName[] {
  return call.kind === "function_call" ? [...(call.path_prefix ?? []), call.name] : call.property_chain;
}

/**
 * How many declared positions lead the argument list: one where the callee
 * declares its receiver as a parameter (Rust's `self`, a Python method's first)
 * and the call supplies it implicitly by calling through an instance; none for a
 * path call or a call through the class (`Base.method(self, cb)`), which pass
 * the receiver as an argument.
 */
function receiver_offset(
  callee: FunctionDefinition | MethodDefinition,
  declared: readonly ParameterDefinition[],
  call: ReceivingCall,
  language: Language | undefined,
  context: ReceiverResolutionContext,
  visited: Set<SymbolId>
): number {
  const declares_receiver =
    callee.kind === "method" &&
    ((language === "rust" && declared[0]?.name === "self") || (language === "python" && !callee.static));
  if (!declares_receiver || call.kind === "function_call") {
    return 0;
  }
  const holder = call.property_chain.slice(0, -1);
  const through_class =
    holder.length > 0 && resolve_read_value(holder, call.scope_id, null, context, visited)?.kind === "class_object";
  return through_class ? 0 : 1;
}

/**
 * The type the annotation `handed` names in the callee's own scope, where its
 * names are written. One naming the callee's type parameters is bound by the
 * call's arguments, else by the parameters' declared bounds, and names nothing
 * where neither binds it — never an unrelated type spelled `T`. Any other
 * resolves as a declared annotation does, so Rust's `Self` is the callee's impl
 * type.
 */
function handed_type(
  handed: string,
  callee: FunctionDefinition | MethodDefinition,
  positional: readonly ParameterDefinition[],
  call: ReceivingCall,
  language: Language,
  context: ReceiverResolutionContext
): SymbolId | null {
  const annotation = parse_type_annotation(handed, language);
  if (!annotation) {
    return null;
  }
  const scope_id = callee.body_scope_id ?? callee.defining_scope_id;
  const generics = callee.generics ?? [];
  const type_parameters = new Set(generics.map((generic) => generic.name));
  if (names_type_parameter(annotation, type_parameters)) {
    return resolve_annotation_in_environment(
      annotation,
      type_parameters,
      {
        call: {
          parameters: positional,
          call_arguments: call_argument_names(call),
          declaring_language: language,
          scope_id: call.scope_id,
        },
        bounds: { parameters: generics, scope_id },
      },
      context
    );
  }
  const found = lookup_annotation(scope_id, annotation, callee.location.file_path, language, context.definitions, {
    ...context,
    resolve_rust_type_path: (module_path, terminal, path_scope_id, referring_file) =>
      resolve_qualified_path_rust(module_path, terminal, "type", path_scope_id, referring_file, context),
  });
  return found ? dereference_named_import(found, context) : null;
}

function names_type_parameter(annotation: ParsedTypeAnnotation, type_parameters: ReadonlySet<SymbolName>): boolean {
  return (
    (annotation.head.length === 1 && type_parameters.has(annotation.head[0])) ||
    annotation.arguments.some((argument) => names_type_parameter(argument, type_parameters))
  );
}

function call_argument_names(call: ReceivingCall): readonly (SymbolName | null)[] | null {
  if (call.kind === "function_call") {
    return call.call_arguments ?? null;
  }
  const chain_arguments = call.kind === "method_call" ? call.property_chain_arguments : undefined;
  return chain_arguments?.[chain_arguments.length - 1] ?? null;
}
