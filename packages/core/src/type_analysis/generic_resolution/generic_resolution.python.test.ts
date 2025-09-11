/**
 * Comprehensive tests for Python-specific generic resolution features
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import { TypeName } from '@ariadnejs/types';
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
      context.type_arguments.set('T', 'str' as TypeName);
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Optional[str]');
      expect(result?.confidence).toBe('exact');
    });

    it('should resolve typing.Optional[T] with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'int' as TypeName);
      
      const result = resolve_python_optional('typing.Optional[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.Optional[int]');
    });

    it('should resolve Optional with complex type', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'List[Dict[str, Any]]' as TypeName);
      
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
      context.type_arguments.set('T', 'str' as TypeName);
      context.type_arguments.set('U', 'int' as TypeName);
      
      const result = resolve_python_union('Union[T, U]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Union[str, int]');
      expect(result?.confidence).toBe('exact');
    });

    it('should resolve typing.Union with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str' as TypeName);
      
      const result = resolve_python_union('typing.Union[T, None]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.Union[str, None]');
    });

    it('should resolve Union with multiple type parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }, { name: 'V' }]);
      context.type_arguments.set('T', 'str' as TypeName);
      context.type_arguments.set('U', 'int' as TypeName);
      context.type_arguments.set('V', 'float' as TypeName);
      
      const result = resolve_python_union('Union[T, U, V]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Union[str, int, float]');
    });

    it('should handle Python 3.10+ union syntax (T | U)', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'str' as TypeName);
      context.type_arguments.set('U', 'int' as TypeName);
      
      const result = resolve_python_union('T | U', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('str | int');
    });

    it('should handle mixed bound and unbound parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'str' as TypeName);
      
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
      context.type_arguments.set('T', 'str' as TypeName);
      
      const result = resolve_python_protocol('Protocol[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Protocol[str]');
    });

    it('should resolve typing.Protocol with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'int' as TypeName);
      
      const result = resolve_python_protocol('typing.Protocol[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.Protocol[int]');
    });

    it('should resolve typing_extensions.Protocol', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'float' as TypeName);
      
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
      context.type_arguments.set('T', 'UserDict' as TypeName);
      
      const result = resolve_python_typeddict('TypedDict[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('TypedDict[UserDict]');
    });

    it('should resolve typing.TypedDict with module prefix', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'ConfigDict' as TypeName);
      
      const result = resolve_python_typeddict('typing.TypedDict[T]', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('typing.TypedDict[ConfigDict]');
    });

    it('should resolve typing_extensions.TypedDict', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'DataDict' as TypeName);
      
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
    const parser = new Parser();
    parser.setLanguage(Python);

    it('should extract simple TypeVar', () => {
      const sourceCode = 'T = TypeVar("T")';
      const tree = parser.parse(sourceCode);
      // Find the assignment node - tree-sitter-python puts it in module > expression_statement > assignment
      let assignmentNode = tree.rootNode.children[0]; // First child is usually the statement
      if (assignmentNode && assignmentNode.type === 'expression_statement') {
        assignmentNode = assignmentNode.children[0]; // Get the assignment from expression_statement
      }
      const result = extract_python_typevar(assignmentNode || tree.rootNode, sourceCode);
      expect(result).toEqual({
        name: 'T',
        constraint: undefined,
        variance: undefined
      });
    });

    it('should extract TypeVar with constraints', () => {
      const sourceCode = 'T = TypeVar("T", str, int, float)';
      const tree = parser.parse(sourceCode);
      let assignmentNode = tree.rootNode.children[0];
      if (assignmentNode && assignmentNode.type === 'expression_statement') {
        assignmentNode = assignmentNode.children[0];
      }
      const result = extract_python_typevar(assignmentNode || tree.rootNode, sourceCode);
      expect(result).toEqual({
        name: 'T',
        constraint: 'str | int | float',
        variance: undefined
      });
    });

    it('should extract TypeVar with bound', () => {
      const sourceCode = 'T = TypeVar("T", bound=Comparable)';
      const tree = parser.parse(sourceCode);
      let assignmentNode = tree.rootNode.children[0];
      if (assignmentNode && assignmentNode.type === 'expression_statement') {
        assignmentNode = assignmentNode.children[0];
      }
      const result = extract_python_typevar(assignmentNode || tree.rootNode, sourceCode);
      expect(result).toEqual({
        name: 'T',
        constraint: 'Comparable',
        variance: undefined
      });
    });

    it('should extract covariant TypeVar', () => {
      const sourceCode = 'T = TypeVar("T", covariant=True)';
      const tree = parser.parse(sourceCode);
      let assignmentNode = tree.rootNode.children[0];
      if (assignmentNode && assignmentNode.type === 'expression_statement') {
        assignmentNode = assignmentNode.children[0];
      }
      const result = extract_python_typevar(assignmentNode || tree.rootNode, sourceCode);
      expect(result).toEqual({
        name: 'T',
        constraint: undefined,
        variance: 'covariant'
      });
    });

    it('should extract contravariant TypeVar', () => {
      const sourceCode = 'T = TypeVar("T", contravariant=True)';
      const tree = parser.parse(sourceCode);
      let assignmentNode = tree.rootNode.children[0];
      if (assignmentNode && assignmentNode.type === 'expression_statement') {
        assignmentNode = assignmentNode.children[0];
      }
      const result = extract_python_typevar(assignmentNode || tree.rootNode, sourceCode);
      expect(result).toEqual({
        name: 'T',
        constraint: undefined,
        variance: 'contravariant'
      });
    });

    it('should extract TypeVar with all options', () => {
      const sourceCode = 'T = TypeVar("T", str, int, bound=Hashable, covariant=True)';
      const tree = parser.parse(sourceCode);
      let assignmentNode = tree.rootNode.children[0];
      if (assignmentNode && assignmentNode.type === 'expression_statement') {
        assignmentNode = assignmentNode.children[0];
      }
      const result = extract_python_typevar(assignmentNode || tree.rootNode, sourceCode);
      expect(result).toEqual({
        name: 'T',
        constraint: 'str | int | Hashable',
        variance: 'covariant'
      });
    });

    it('should return null for invalid TypeVar declarations', () => {
      const sourceCode1 = 'T = something_else';
      const tree1 = parser.parse(sourceCode1);
      let assignmentNode1 = tree1.rootNode.children[0];
      if (assignmentNode1 && assignmentNode1.type === 'expression_statement') {
        assignmentNode1 = assignmentNode1.children[0];
      }
      expect(extract_python_typevar(assignmentNode1 || tree1.rootNode, sourceCode1)).toBeNull();
      
      const sourceCode2 = 'invalid syntax';
      const tree2 = parser.parse(sourceCode2);
      let assignmentNode2 = tree2.rootNode.children[0];
      if (assignmentNode2 && assignmentNode2.type === 'expression_statement') {
        assignmentNode2 = assignmentNode2.children[0];
      }
      expect(extract_python_typevar(assignmentNode2 || tree2.rootNode, sourceCode2)).toBeNull();
      
      const sourceCode3 = '';
      const tree3 = parser.parse(sourceCode3);
      let assignmentNode3 = tree3.rootNode.children[0];
      if (assignmentNode3 && assignmentNode3.type === 'expression_statement') {
        assignmentNode3 = assignmentNode3.children[0];
      }
      expect(extract_python_typevar(assignmentNode3 || tree3.rootNode, sourceCode3)).toBeNull();
    });
  });

  describe('Generic Base Class Extraction', () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it('should extract simple generic base', () => {
      const sourceCode = 'class MyList(Generic[T]): pass';
      const tree = parser.parse(sourceCode);
      const classNode = tree.rootNode.children[0]; // Get the class definition node
      const result = extract_python_generic_base(classNode, sourceCode);
      expect(result).toEqual([
        { name: 'T' }
      ]);
    });

    it('should extract multiple type parameters', () => {
      const sourceCode = 'class MyDict(Generic[K, V]): pass';
      const tree = parser.parse(sourceCode);
      const classNode = tree.rootNode.children[0];
      const result = extract_python_generic_base(classNode, sourceCode);
      expect(result).toEqual([
        { name: 'K' },
        { name: 'V' }
      ]);
    });

    it('should extract generic with other base classes', () => {
      const sourceCode = 'class MyList(list, Generic[T]): pass';
      const tree = parser.parse(sourceCode);
      const classNode = tree.rootNode.children[0];
      const result = extract_python_generic_base(classNode, sourceCode);
      expect(result).toEqual([
        { name: 'T' }
      ]);
    });

    it('should extract generic with typing module prefix', () => {
      const sourceCode = 'class MyList(typing.Generic[T]): pass';
      const tree = parser.parse(sourceCode);
      const classNode = tree.rootNode.children[0];
      const result = extract_python_generic_base(classNode, sourceCode);
      expect(result).toEqual([
        { name: 'T' }
      ]);
    });

    it('should handle complex type parameters', () => {
      const sourceCode = 'class MyContainer(Generic[T], Protocol): pass';
      const tree = parser.parse(sourceCode);
      const classNode = tree.rootNode.children[0];
      const result = extract_python_generic_base(classNode, sourceCode);
      expect(result).toEqual([
        { name: 'T' }
      ]);
    });

    it('should return null for non-generic classes', () => {
      const sourceCode1 = 'class MyClass: pass';
      const tree1 = parser.parse(sourceCode1);
      const classNode1 = tree1.rootNode.children[0];
      expect(extract_python_generic_base(classNode1, sourceCode1)).toEqual([]);
      
      const sourceCode2 = 'class MyClass(object): pass';
      const tree2 = parser.parse(sourceCode2);
      const classNode2 = tree2.rootNode.children[0];
      expect(extract_python_generic_base(classNode2, sourceCode2)).toEqual([]);
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
      context.type_arguments.set('T', 'List[Dict[str, Any]]' as TypeName);
      
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
      context.type_arguments.set('T', '"special-type"' as TypeName);
      
      const result = resolve_python_optional('Optional[T]', context);
      expect(result?.resolved_type).toBe('Optional["special-type"]');
    });
  });
});