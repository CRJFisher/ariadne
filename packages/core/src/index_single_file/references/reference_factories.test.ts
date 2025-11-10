import { describe, test, expect } from 'vitest';
import {
  create_self_reference_call,
  create_method_call_reference,
  create_function_call_reference,
  create_constructor_call_reference,
  create_variable_reference,
  create_property_access_reference,
  create_type_reference,
  create_assignment_reference,
} from './reference_factories';
import type { Location, ScopeId, SymbolName } from '@ariadnejs/types';

const mock_location: Location = {
  start_line: 10,
  start_column: 5,
  end_line: 10,
  end_column: 15,
};

const mock_receiver_location: Location = {
  start_line: 10,
  start_column: 5,
  end_line: 10,
  end_column: 8,
};

const mock_target_location: Location = {
  start_line: 10,
  start_column: 0,
  end_line: 10,
  end_column: 3,
};

const mock_scope_id = 'scope:test:1' as ScopeId;

describe('Reference Factories', () => {
  describe('create_self_reference_call', () => {
    test('creates valid SelfReferenceCall with this keyword', () => {
      const ref = create_self_reference_call(
        'method' as SymbolName,
        mock_location,
        mock_scope_id,
        'this',
        ['this', 'method']
      );

      expect(ref).toEqual({
        kind: 'self_reference_call',
        name: 'method',
        location: mock_location,
        scope_id: mock_scope_id,
        keyword: 'this',
        property_chain: ['this', 'method'],
      });
    });

    test('creates valid SelfReferenceCall with self keyword', () => {
      const ref = create_self_reference_call(
        'process_data' as SymbolName,
        mock_location,
        mock_scope_id,
        'self',
        ['self', 'process_data']
      );

      expect(ref.kind).toBe('self_reference_call');
      expect(ref.keyword).toBe('self');
      expect(ref.name).toBe('process_data');
      expect(ref.property_chain).toEqual(['self', 'process_data']);
    });

    test('creates valid SelfReferenceCall with super keyword', () => {
      const ref = create_self_reference_call(
        'parent_method' as SymbolName,
        mock_location,
        mock_scope_id,
        'super',
        ['super', 'parent_method']
      );

      expect(ref.kind).toBe('self_reference_call');
      expect(ref.keyword).toBe('super');
    });

    test('creates valid SelfReferenceCall with cls keyword', () => {
      const ref = create_self_reference_call(
        'class_method' as SymbolName,
        mock_location,
        mock_scope_id,
        'cls',
        ['cls', 'class_method']
      );

      expect(ref.kind).toBe('self_reference_call');
      expect(ref.keyword).toBe('cls');
    });
  });

  describe('create_method_call_reference', () => {
    test('creates valid MethodCallReference', () => {
      const ref = create_method_call_reference(
        'getName' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['user', 'getName']
      );

      expect(ref).toEqual({
        kind: 'method_call',
        name: 'getName',
        location: mock_location,
        scope_id: mock_scope_id,
        receiver_location: mock_receiver_location,
        property_chain: ['user', 'getName'],
      });
    });

    test('creates MethodCallReference with longer property chain', () => {
      const ref = create_method_call_reference(
        'doSomething' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['obj', 'field', 'doSomething']
      );

      expect(ref.kind).toBe('method_call');
      expect(ref.property_chain).toEqual(['obj', 'field', 'doSomething']);
    });
  });

  describe('create_function_call_reference', () => {
    test('creates valid FunctionCallReference', () => {
      const ref = create_function_call_reference(
        'processData' as SymbolName,
        mock_location,
        mock_scope_id
      );

      expect(ref).toEqual({
        kind: 'function_call',
        name: 'processData',
        location: mock_location,
        scope_id: mock_scope_id,
      });
    });

    test('has only required fields', () => {
      const ref = create_function_call_reference(
        'helper' as SymbolName,
        mock_location,
        mock_scope_id
      );

      expect(ref.kind).toBe('function_call');
      expect(Object.keys(ref)).toEqual(['kind', 'name', 'location', 'scope_id']);
    });
  });

  describe('create_constructor_call_reference', () => {
    test('creates valid ConstructorCallReference', () => {
      const ref = create_constructor_call_reference(
        'MyClass' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_target_location
      );

      expect(ref).toEqual({
        kind: 'constructor_call',
        name: 'MyClass',
        location: mock_location,
        scope_id: mock_scope_id,
        construct_target: mock_target_location,
      });
    });

    test('includes construct_target location', () => {
      const ref = create_constructor_call_reference(
        'Service' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_target_location
      );

      expect(ref.kind).toBe('constructor_call');
      expect(ref.construct_target).toEqual(mock_target_location);
    });
  });

  describe('create_variable_reference', () => {
    test('creates valid VariableReference for read', () => {
      const ref = create_variable_reference(
        'x' as SymbolName,
        mock_location,
        mock_scope_id,
        'read'
      );

      expect(ref).toEqual({
        kind: 'variable_reference',
        name: 'x',
        location: mock_location,
        scope_id: mock_scope_id,
        access_type: 'read',
      });
    });

    test('creates valid VariableReference for write', () => {
      const ref = create_variable_reference(
        'y' as SymbolName,
        mock_location,
        mock_scope_id,
        'write'
      );

      expect(ref.kind).toBe('variable_reference');
      expect(ref.access_type).toBe('write');
    });
  });

  describe('create_property_access_reference', () => {
    test('creates valid PropertyAccessReference with property access', () => {
      const ref = create_property_access_reference(
        'name' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['user', 'name'],
        'property',
        false
      );

      expect(ref).toEqual({
        kind: 'property_access',
        name: 'name',
        location: mock_location,
        scope_id: mock_scope_id,
        receiver_location: mock_receiver_location,
        property_chain: ['user', 'name'],
        access_type: 'property',
        is_optional_chain: false,
      });
    });

    test('creates valid PropertyAccessReference with index access', () => {
      const ref = create_property_access_reference(
        'item' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['array', 'item'],
        'index',
        false
      );

      expect(ref.kind).toBe('property_access');
      expect(ref.access_type).toBe('index');
    });

    test('creates PropertyAccessReference with optional chaining', () => {
      const ref = create_property_access_reference(
        'field' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['obj', 'field'],
        'property',
        true
      );

      expect(ref.kind).toBe('property_access');
      expect(ref.is_optional_chain).toBe(true);
    });
  });

  describe('create_type_reference', () => {
    test('creates valid TypeReference with annotation context', () => {
      const ref = create_type_reference(
        'MyType' as SymbolName,
        mock_location,
        mock_scope_id,
        'annotation'
      );

      expect(ref).toEqual({
        kind: 'type_reference',
        name: 'MyType',
        location: mock_location,
        scope_id: mock_scope_id,
        type_context: 'annotation',
      });
    });

    test('creates valid TypeReference with extends context', () => {
      const ref = create_type_reference(
        'BaseClass' as SymbolName,
        mock_location,
        mock_scope_id,
        'extends'
      );

      expect(ref.kind).toBe('type_reference');
      expect(ref.type_context).toBe('extends');
    });

    test('creates valid TypeReference with implements context', () => {
      const ref = create_type_reference(
        'Interface' as SymbolName,
        mock_location,
        mock_scope_id,
        'implements'
      );

      expect(ref.kind).toBe('type_reference');
      expect(ref.type_context).toBe('implements');
    });

    test('creates valid TypeReference with generic context', () => {
      const ref = create_type_reference(
        'T' as SymbolName,
        mock_location,
        mock_scope_id,
        'generic'
      );

      expect(ref.kind).toBe('type_reference');
      expect(ref.type_context).toBe('generic');
    });

    test('creates valid TypeReference with return context', () => {
      const ref = create_type_reference(
        'ReturnType' as SymbolName,
        mock_location,
        mock_scope_id,
        'return'
      );

      expect(ref.kind).toBe('type_reference');
      expect(ref.type_context).toBe('return');
    });
  });

  describe('create_assignment_reference', () => {
    test('creates valid AssignmentReference', () => {
      const ref = create_assignment_reference(
        'x' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_target_location
      );

      expect(ref).toEqual({
        kind: 'assignment',
        name: 'x',
        location: mock_location,
        scope_id: mock_scope_id,
        target_location: mock_target_location,
      });
    });

    test('includes target_location', () => {
      const ref = create_assignment_reference(
        'value' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_target_location
      );

      expect(ref.kind).toBe('assignment');
      expect(ref.target_location).toEqual(mock_target_location);
    });
  });

  describe('Type safety', () => {
    test('all factories return objects with correct kind discriminator', () => {
      const self_ref = create_self_reference_call(
        'method' as SymbolName,
        mock_location,
        mock_scope_id,
        'this',
        ['this', 'method']
      );
      const method_ref = create_method_call_reference(
        'method' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['obj', 'method']
      );
      const func_ref = create_function_call_reference(
        'func' as SymbolName,
        mock_location,
        mock_scope_id
      );
      const ctor_ref = create_constructor_call_reference(
        'Class' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_target_location
      );
      const var_ref = create_variable_reference(
        'x' as SymbolName,
        mock_location,
        mock_scope_id,
        'read'
      );
      const prop_ref = create_property_access_reference(
        'field' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_receiver_location,
        ['obj', 'field'],
        'property',
        false
      );
      const type_ref = create_type_reference(
        'Type' as SymbolName,
        mock_location,
        mock_scope_id,
        'annotation'
      );
      const assign_ref = create_assignment_reference(
        'x' as SymbolName,
        mock_location,
        mock_scope_id,
        mock_target_location
      );

      expect(self_ref.kind).toBe('self_reference_call');
      expect(method_ref.kind).toBe('method_call');
      expect(func_ref.kind).toBe('function_call');
      expect(ctor_ref.kind).toBe('constructor_call');
      expect(var_ref.kind).toBe('variable_reference');
      expect(prop_ref.kind).toBe('property_access');
      expect(type_ref.kind).toBe('type_reference');
      expect(assign_ref.kind).toBe('assignment');
    });
  });
});
