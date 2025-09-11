/**
 * Comprehensive tests for Python-specific generic resolution features
 */

import { describe, it, expect } from 'vitest';
import {
  resolve_python_optional,
  resolve_python_union,
  resolve_python_protocol,
  resolve_python_typeddict,
  extract_python_typevar,
  extract_python_generic_base
} from './generic_resolution.python';
import { create_generic_context } from './generic_resolution';

describe('Python Generic Resolution', () => {
  describe('Optional Types', () => {
    it('should resolve Optional[T] with bound type parameter', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str');
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Optional[str]');
      expect(result?.confidence).toBe('exact');
    });

    it('should resolve typing.Optional[T] with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'int');
      
      const result = resolve_python_optional('typing.Optional[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.Optional[int]');
    });

    it('should resolve Optional with complex type', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'List[Dict[str, Any]]');
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Optional[List[Dict[str, Any]]]');
    });

    it('should handle unbound type parameter', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Optional[T]');
      expect(result?.confidence).toBe('partial');
    });

    it('should return null for non-Optional types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_python_optional('List[T]', context);
      expect(result).toBeNull();
    });
  });

  describe('Union Types', () => {
    it('should resolve Union[T, U] with bound parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'str');
      context.type_arguments.set('U', 'int');
      
      const result = resolve_python_union('Union[T, U]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Union[str, int]');
      expect(result?.confidence).toBe('exact');
    });

    it('should resolve typing.Union with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str');
      
      const result = resolve_python_union('typing.Union[T, None]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.Union[str, None]');
    });

    it('should resolve Union with multiple type parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }, { name: 'V' }]);
      context.type_arguments.set('T', 'str');
      context.type_arguments.set('U', 'int');
      context.type_arguments.set('V', 'float');
      
      const result = resolve_python_union('Union[T, U, V]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Union[str, int, float]');
    });

    it('should handle Python 3.10+ union syntax (T | U)', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'str');
      context.type_arguments.set('U', 'int');
      
      const result = resolve_python_union('T | U', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('str | int');
    });

    it('should handle mixed bound and unbound parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'str');
      
      const result = resolve_python_union('Union[T, U]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Union[str, U]');
      expect(result?.confidence).toBe('partial');
    });

    it('should return null for non-Union types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_python_union('List[T]', context);
      expect(result).toBeNull();
    });
  });

  describe('Protocol Types', () => {
    it('should resolve Protocol with type parameter', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str');
      
      const result = resolve_python_protocol('Protocol[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Protocol[str]');
    });

    it('should resolve typing.Protocol with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'int');
      
      const result = resolve_python_protocol('typing.Protocol[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.Protocol[int]');
    });

    it('should resolve typing_extensions.Protocol', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'float');
      
      const result = resolve_python_protocol('typing_extensions.Protocol[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing_extensions.Protocol[float]');
    });

    it('should return null for non-Protocol types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_python_protocol('List[T]', context);
      expect(result).toBeNull();
    });
  });

  describe('TypedDict Types', () => {
    it('should resolve TypedDict with type parameter', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'UserDict');
      
      const result = resolve_python_typeddict('TypedDict[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('TypedDict[UserDict]');
    });

    it('should resolve typing.TypedDict with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'ConfigDict');
      
      const result = resolve_python_typeddict('typing.TypedDict[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.TypedDict[ConfigDict]');
    });

    it('should resolve typing_extensions.TypedDict', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'DataDict');
      
      const result = resolve_python_typeddict('typing_extensions.TypedDict[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing_extensions.TypedDict[DataDict]');
    });

    it('should return null for non-TypedDict types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_python_typeddict('Dict[T]', context);
      expect(result).toBeNull();
    });
  });

  describe('TypeVar Extraction', () => {
    it('should extract simple TypeVar', () => {
      const result = extract_python_typevar('T = TypeVar("T")');
      expect(result).toEqual({
        name: 'T',
        constraints: [],
        bound: null,
        covariant: false,
        contravariant: false
      });
    });

    it('should extract TypeVar with constraints', () => {
      const result = extract_python_typevar('T = TypeVar("T", str, int, float)');
      expect(result).toEqual({
        name: 'T',
        constraints: ['str', 'int', 'float'],
        bound: null,
        covariant: false,
        contravariant: false
      });
    });

    it('should extract TypeVar with bound', () => {
      const result = extract_python_typevar('T = TypeVar("T", bound=Comparable)');
      expect(result).toEqual({
        name: 'T',
        constraints: [],
        bound: 'Comparable',
        covariant: false,
        contravariant: false
      });
    });

    it('should extract covariant TypeVar', () => {
      const result = extract_python_typevar('T = TypeVar("T", covariant=True)');
      expect(result).toEqual({
        name: 'T',
        constraints: [],
        bound: null,
        covariant: true,
        contravariant: false
      });
    });

    it('should extract contravariant TypeVar', () => {
      const result = extract_python_typevar('T = TypeVar("T", contravariant=True)');
      expect(result).toEqual({
        name: 'T',
        constraints: [],
        bound: null,
        covariant: false,
        contravariant: true
      });
    });

    it('should extract TypeVar with all options', () => {
      const result = extract_python_typevar('T = TypeVar("T", str, int, bound=Hashable, covariant=True)');
      expect(result).toEqual({
        name: 'T',
        constraints: ['str', 'int'],
        bound: 'Hashable',
        covariant: true,
        contravariant: false
      });
    });

    it('should return null for invalid TypeVar declarations', () => {
      expect(extract_python_typevar('T = something_else')).toBeNull();
      expect(extract_python_typevar('invalid syntax')).toBeNull();
      expect(extract_python_typevar('')).toBeNull();
    });
  });

  describe('Generic Base Class Extraction', () => {
    it('should extract simple generic base', () => {
      const result = extract_python_generic_base('class MyList(Generic[T]): pass');
      expect(result).toEqual({
        class_name: 'MyList',
        type_parameters: ['T'],
        base_classes: ['Generic[T]']
      });
    });

    it('should extract multiple type parameters', () => {
      const result = extract_python_generic_base('class MyDict(Generic[K, V]): pass');
      expect(result).toEqual({
        class_name: 'MyDict',
        type_parameters: ['K', 'V'],
        base_classes: ['Generic[K, V]']
      });
    });

    it('should extract generic with other base classes', () => {
      const result = extract_python_generic_base('class MyList(list, Generic[T]): pass');
      expect(result).toEqual({
        class_name: 'MyList',
        type_parameters: ['T'],
        base_classes: ['list', 'Generic[T]']
      });
    });

    it('should extract generic with typing module prefix', () => {
      const result = extract_python_generic_base('class MyList(typing.Generic[T]): pass');
      expect(result).toEqual({
        class_name: 'MyList',
        type_parameters: ['T'],
        base_classes: ['typing.Generic[T]']
      });
    });

    it('should handle complex type parameters', () => {
      const result = extract_python_generic_base('class MyContainer(Generic[T], Protocol): pass');
      expect(result).toEqual({
        class_name: 'MyContainer',
        type_parameters: ['T'],
        base_classes: ['Generic[T]', 'Protocol']
      });
    });

    it('should return null for non-generic classes', () => {
      expect(extract_python_generic_base('class MyClass: pass')).toBeNull();
      expect(extract_python_generic_base('class MyClass(object): pass')).toBeNull();
      expect(extract_python_generic_base('invalid syntax')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context gracefully', () => {
      const context = create_generic_context([]);
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result?.resolved_type).toBe('Optional[T]');
      expect(result?.confidence).toBe('partial');
    });

    it('should handle nested generic types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'List[Dict[str, Any]]');
      
      const result = resolve_python_union('Union[T, None]', context);
      expect(result?.resolved_type).toBe('Union[List[Dict[str, Any]], None]');
    });

    it('should handle malformed type expressions gracefully', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      expect(resolve_python_optional('Optional[')).toBeNull();
      expect(resolve_python_union('Union[T,')).toBeNull();
      expect(resolve_python_protocol('Protocol')).toBeNull();
      expect(resolve_python_typeddict('TypedDict')).toBeNull();
    });

    it('should handle very long type parameter names', () => {
      const longName = 'T'.repeat(100);
      const context = create_generic_context([{ name: longName }]);
      context.type_arguments.set(longName, 'str');
      
      const result = resolve_python_optional(`Optional[${longName}]`, context);
      expect(result?.resolved_type).toBe('Optional[str]');
    });

    it('should handle special characters in type names', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', '"special-type"');
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result?.resolved_type).toBe('Optional["special-type"]');
    });
  });
});