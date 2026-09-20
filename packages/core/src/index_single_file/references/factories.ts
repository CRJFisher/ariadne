import type {
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  ConstructorCallReference,
  VariableReference,
  PropertyAccessReference,
  CallableValueReference,
  TypeReference,
  AssignmentReference,
  CallSiteSyntax,
  ChainCallArguments,
  Location,
  SymbolName,
  ScopeId,
  SelfReferenceKeyword,
  TypeInfo,
} from "@ariadnejs/types";
import type { ConstructTarget } from "../query_code_tree/metadata_extractors/metadata_extractor_types";


/**
 * Factory for self-reference calls: this.method(), self.method(), super.method()
 *
 * @example
 * // TypeScript: this.build_class(node)
 * create_self_reference_call(
 *   'build_class',
 *   location,
 *   scope_id,
 *   'this',
 *   ['this', 'build_class']
 * )
 *
 * @example
 * // Python: self.process_data(x)
 * create_self_reference_call(
 *   'process_data',
 *   location,
 *   scope_id,
 *   'self',
 *   ['self', 'process_data']
 * )
 */
export function create_self_reference_call(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  keyword: SelfReferenceKeyword,
  property_chain: readonly SymbolName[],
  index_access?: { readonly key_is_literal: boolean }
): SelfReferenceCall {
  return {
    kind: "self_reference_call",
    name,
    location,
    scope_id,
    keyword,
    property_chain,
    ...(index_access !== undefined && { index_access }),
  };
}

/**
 * Factory for method calls: obj.method(), receiver.getName()
 *
 * @example
 * // user.getName()
 * create_method_call_reference(
 *   'getName',
 *   call_location,
 *   scope_id,
 *   user_location,
 *   ['user', 'getName'],
 *   false
 * )
 */
export function create_method_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[],
  is_optional_chain: boolean,
  potential_construct_target?: ConstructTarget,
  call_site_syntax?: CallSiteSyntax,
  property_chain_arguments?: ChainCallArguments
): MethodCallReference {
  return {
    kind: "method_call",
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
    is_optional_chain,
    ...(potential_construct_target?.holds === "value" && {
      potential_construct_target: potential_construct_target.location,
    }),
    ...(potential_construct_target?.holds === "element" && {
      potential_construct_element_of: potential_construct_target.location,
    }),
    ...(call_site_syntax !== undefined && { call_site_syntax }),
    ...(property_chain_arguments !== undefined && { property_chain_arguments }),
  };
}

/**
 * Factory for function calls: foo(), myFunction()
 *
 * @example Basic function call
 * // processData(value)
 * create_function_call_reference('processData', location, scope_id)
 *
 * @example Python call with potential constructor target
 * // obj = MyClass()  -- captured as function_call, may be class instantiation
 * create_function_call_reference('MyClass', location, scope_id, obj_location)
 */
export function create_function_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  potential_construct_target?: ConstructTarget,
  path_prefix?: readonly SymbolName[],
  call_arguments?: readonly (SymbolName | null)[]
): FunctionCallReference {
  return {
    kind: "function_call",
    name,
    location,
    scope_id,
    ...(call_arguments !== undefined && { call_arguments }),
    ...(potential_construct_target?.holds === "value" && {
      potential_construct_target: potential_construct_target.location,
    }),
    ...(potential_construct_target?.holds === "element" && {
      potential_construct_element_of: potential_construct_target.location,
    }),
    ...(path_prefix !== undefined && { path_prefix }),
  };
}

/**
 * Factory for constructor calls: new MyClass(), MyClass() (Python)
 *
 * @example With assignment
 * // const obj = new MyClass()
 * create_constructor_call_reference(
 *   'MyClass',
 *   new_expression_location,
 *   scope_id,
 *   obj_location
 * )
 *
 * @example Namespace-qualified
 * // const user = new models.User(name)
 * create_constructor_call_reference(
 *   'User',
 *   new_expression_location,
 *   scope_id,
 *   user_location,
 *   ['models', 'User']
 * )
 *
 * @example Standalone
 * // MyClass()  // side effect only
 * create_constructor_call_reference(
 *   'MyClass',
 *   call_location,
 *   scope_id
 * )
 */
export function create_constructor_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  construct_target?: ConstructTarget,
  property_chain?: readonly SymbolName[],
  path_prefix?: readonly SymbolName[]
): ConstructorCallReference {
  return {
    kind: "constructor_call",
    name,
    location,
    scope_id,
    ...(construct_target?.holds === "value" && { construct_target: construct_target.location }),
    ...(construct_target?.holds === "element" && {
      construct_element_of: construct_target.location,
    }),
    ...(property_chain !== undefined && { property_chain }),
    ...(path_prefix !== undefined && { path_prefix }),
  };
}

/**
 * Factory for variable references: reading or writing variables
 *
 * @example
 * // const y = x  (reading x)
 * create_variable_reference('x', location, scope_id, 'read')
 *
 * @example
 * // x = 10  (writing to x)
 * create_variable_reference('x', location, scope_id, 'write')
 */
export function create_variable_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  access_type: "read" | "write"
): VariableReference {
  return {
    kind: "variable_reference",
    name,
    location,
    scope_id,
    access_type,
  };
}

/**
 * Factory for property access: obj.field (not calling a method)
 *
 * @example
 * // const name = user.name  (accessing field, not calling)
 * create_property_access_reference(
 *   'name',
 *   access_location,
 *   scope_id,
 *   user_location,
 *   ['user', 'name'],
 *   'property',
 *   false
 * )
 */
export function create_property_access_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[],
  access_type: "property" | "index",
  is_optional_chain: boolean
): PropertyAccessReference {
  return {
    kind: "property_access",
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
    access_type,
    is_optional_chain,
  };
}

/**
 * Factory for callable-value references: a callable read in value position
 *
 * @example
 * // app.get('/users', user.list)
 * create_callable_value_reference('list', location, scope_id, ['user', 'list'], receiver_location)
 */
export function create_callable_value_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  property_chain: readonly SymbolName[],
  receiver_location?: Location
): CallableValueReference {
  return {
    kind: "callable_value",
    name,
    location,
    scope_id,
    property_chain,
    receiver_location,
  };
}

/**
 * Factory for type references: type annotations, extends clauses
 *
 * @example
 * // const x: MyType = ...
 * create_type_reference('MyType', location, scope_id, 'annotation')
 *
 * @example
 * // class A extends Base { }
 * create_type_reference('Base', location, scope_id, 'extends')
 */
export function create_type_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  type_context: "annotation" | "extends" | "implements" | "generic" | "return",
  type_info?: TypeInfo
): TypeReference {
  return {
    kind: "type_reference",
    name,
    location,
    scope_id,
    type_context,
    ...(type_info !== undefined && { type_info }),
  };
}

/**
 * Factory for assignments: x = value
 *
 * @example
 * // x = getValue()
 * create_assignment_reference('x', location, scope_id, x_location)
 *
 * @example With type annotation
 * // let service1: Service = create_service()
 * create_assignment_reference('service1', location, scope_id, service1_location, type_info)
 */
export function create_assignment_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  target_location: Location,
  assignment_type?: TypeInfo
): AssignmentReference {
  return {
    kind: "assignment",
    name,
    location,
    scope_id,
    target_location,
    ...(assignment_type !== undefined && { assignment_type }),
  };
}
