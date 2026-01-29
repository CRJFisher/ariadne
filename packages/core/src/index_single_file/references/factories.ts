import type {
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  ConstructorCallReference,
  VariableReference,
  PropertyAccessReference,
  TypeReference,
  AssignmentReference,
  Location,
  SymbolName,
  ScopeId,
  SelfReferenceKeyword,
  TypeInfo,
} from "@ariadnejs/types";

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
  property_chain: readonly SymbolName[]
): SelfReferenceCall {
  return {
    kind: "self_reference_call",
    name,
    location,
    scope_id,
    keyword,
    property_chain,
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
 *   ['user', 'getName']
 * )
 */
export function create_method_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[],
  optional_chaining?: boolean
): MethodCallReference {
  return {
    kind: "method_call",
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
    ...(optional_chaining !== undefined && { optional_chaining }),
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
  potential_construct_target?: Location
): FunctionCallReference {
  return {
    kind: "function_call",
    name,
    location,
    scope_id,
    ...(potential_construct_target !== undefined && { potential_construct_target }),
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
  construct_target?: Location
): ConstructorCallReference {
  return {
    kind: "constructor_call",
    name,
    location,
    scope_id,
    ...(construct_target !== undefined && { construct_target }),
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
    ...(type_info && { type_info }),
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
    ...(assignment_type && { assignment_type }),
  };
}
