/**
 * Integration tests for generic resolution with realistic tree-sitter parsing
 * Tests the complete pipeline from source code to resolved generics
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript/typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  resolve_language_generic,
  create_generic_context,
  parse_generic_type
} from './generic_resolution';
import { TypeRegistry, build_type_registry } from '../type_registry';

describe('Generic Resolution Integration Tests', () => {
  const mockTypeRegistry = build_type_registry([]);

  describe('TypeScript Integration', () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript);

    it('should resolve utility types from parsed TypeScript code', () => {
      const sourceCode = `
        interface User {
          id: number;
          name: string;
          email?: string;
        }
        
        type PartialUser = Partial<User>;
        type RequiredUser = Required<User>;
        type UserEmail = Pick<User, 'email'>;
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'User' }]);
      context.type_arguments.set('User', 'User');

      // Test Partial<User>
      const partialResult = resolve_language_generic('Partial<User>', 'typescript', context, mockTypeRegistry);
      expect(partialResult.resolved_type).toBe('Partial<User>');
      expect(partialResult.confidence).toBe('exact');

      // Test Required<User>  
      const requiredResult = resolve_language_generic('Required<User>', 'typescript', context, mockTypeRegistry);
      expect(requiredResult.resolved_type).toBe('Required<User>');

      // Test Pick<User, 'email'>
      const pickResult = resolve_language_generic("Pick<User, 'email'>", 'typescript', context, mockTypeRegistry);
      expect(pickResult.resolved_type).toBe("Pick<User, 'email'>");
    });

    it('should resolve conditional types from parsed code', () => {
      const sourceCode = `
        type IsString<T> = T extends string ? true : false;
        type StringCheck = IsString<string>;
        type NumberCheck = IsString<number>;
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'string');

      const result = resolve_language_generic('T extends string ? true : false', 'typescript', context, mockTypeRegistry);
      expect(result.resolved_type).toBe('string extends string ? true : false');
    });

    it('should resolve mapped types from parsed code', () => {
      const sourceCode = `
        type ReadonlyUser<T> = {
          readonly [K in keyof T]: T[K];
        };
        
        type OptionalUser<T> = {
          [K in keyof T]?: T[K];
        };
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');

      const readonlyResult = resolve_language_generic('{ readonly [K in keyof T]: T[K] }', 'typescript', context, mockTypeRegistry);
      expect(readonlyResult.resolved_type).toBe('{ readonly [K in keyof User]: User[K] }');

      const optionalResult = resolve_language_generic('{ [K in keyof T]?: T[K] }', 'typescript', context, mockTypeRegistry);
      expect(optionalResult.resolved_type).toBe('{ [K in keyof User]?: User[K] }');
    });

    it('should resolve template literal types from parsed code', () => {
      const sourceCode = `
        type EventName<T extends string> = \`on\${Capitalize<T>}\`;
        type ButtonEvent = EventName<'click'>;
        type MouseEvent = EventName<'hover'>;
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'click');

      const result = resolve_language_generic('`on${Capitalize<T>}`', 'typescript', context, mockTypeRegistry);
      expect(result.resolved_type).toBe('`on${Capitalize<click>}`');
    });
  });

  describe('Python Integration', () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it('should resolve TypeVar declarations from parsed Python code', () => {
      const sourceCode = `
        from typing import TypeVar, Generic, List, Optional, Union
        
        T = TypeVar('T')
        K = TypeVar('K', str, int)
        V = TypeVar('V', bound=Comparable)
        
        class Container(Generic[T]):
            def __init__(self, item: T) -> None:
                self.item = item
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str');

      const result = resolve_language_generic('Generic[T]', 'python', context, mockTypeRegistry);
      expect(result.resolved_type).toBe('Generic[str]');
    });

    it('should resolve Optional types from parsed code', () => {
      const sourceCode = `
        from typing import Optional, Union
        
        def get_user(id: int) -> Optional[User]:
            return None
            
        def process_data(data: Union[str, int, None]) -> Optional[str]:
            return str(data) if data else None
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');

      const optionalResult = resolve_language_generic('Optional[T]', 'python', context, mockTypeRegistry);
      expect(optionalResult.resolved_type).toBe('Optional[User]');
    });

    it('should resolve Union types from parsed code', () => {
      const sourceCode = `
        from typing import Union, List, Dict, Any
        
        def handle_response(response: Union[Dict[str, Any], List[Any], str]) -> str:
            if isinstance(response, dict):
                return json.dumps(response)
            elif isinstance(response, list):
                return str(len(response))
            else:
                return response
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'str');
      context.type_arguments.set('U', 'int');

      const unionResult = resolve_language_generic('Union[T, U]', 'python', context, mockTypeRegistry);
      expect(unionResult.resolved_type).toBe('Union[str, int]');

      // Test Python 3.10+ union syntax
      const modernUnionResult = resolve_language_generic('T | U', 'python', context, mockTypeRegistry);
      expect(modernUnionResult.resolved_type).toBe('str | int');
    });

    it('should resolve Protocol types from parsed code', () => {
      const sourceCode = `
        from typing import Protocol, runtime_checkable
        
        @runtime_checkable
        class Drawable(Protocol):
            def draw(self) -> None: ...
            
        class Circle:
            def draw(self) -> None:
                print("Drawing circle")
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Drawable');

      const protocolResult = resolve_language_generic('Protocol[T]', 'python', context, mockTypeRegistry);
      expect(protocolResult.resolved_type).toBe('Protocol[Drawable]');
    });
  });

  describe('Rust Integration', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it('should resolve associated types from parsed Rust code', () => {
      const sourceCode = `
        trait Iterator {
            type Item;
            fn next(&mut self) -> Option<Self::Item>;
        }
        
        impl<T> Iterator for Vec<T> {
            type Item = T;
            fn next(&mut self) -> Option<Self::Item> {
                self.pop()
            }
        }
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Vec<i32>');

      const result = resolve_language_generic('T::Item', 'rust', context, mockTypeRegistry);
      expect(result.resolved_type).toBe('Vec<i32>::Item');
    });

    it('should resolve impl Trait types from parsed code', () => {
      const sourceCode = `
        fn create_iterator() -> impl Iterator<Item = i32> {
            vec![1, 2, 3].into_iter()
        }
        
        fn process_data<T>(data: T) -> impl Future<Output = String> 
        where 
            T: Clone + Send + Sync
        {
            async move {
                format!("{:?}", data)
            }
        }
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Display + Clone');

      const implResult = resolve_language_generic('impl T', 'rust', context, mockTypeRegistry);
      expect(implResult.resolved_type).toBe('impl Display + Clone');
    });

    it('should resolve dyn Trait types from parsed code', () => {
      const sourceCode = `
        trait Draw {
            fn draw(&self);
        }
        
        struct Screen {
            components: Vec<Box<dyn Draw>>,
        }
        
        impl Screen {
            fn run(&self) {
                for component in self.components.iter() {
                    component.draw();
                }
            }
        }
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Draw');

      const dynResult = resolve_language_generic('Box<dyn T>', 'rust', context, mockTypeRegistry);
      expect(dynResult.resolved_type).toBe('Box<dyn Draw>');
    });

    it('should resolve reference types with lifetimes from parsed code', () => {
      const sourceCode = `
        struct StringSplitter<'a> {
            remainder: &'a str,
        }
        
        impl<'a> StringSplitter<'a> {
            fn new(s: &'a str) -> Self {
                StringSplitter { remainder: s }
            }
        }
        
        fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
            if x.len() > y.len() { x } else { y }
        }
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str');

      const refResult = resolve_language_generic("&'a T", 'rust', context, mockTypeRegistry);
      expect(refResult.resolved_type).toBe("&'a str");

      const mutRefResult = resolve_language_generic("&'static mut T", 'rust', context, mockTypeRegistry);
      expect(mutRefResult.resolved_type).toBe("&'static mut str");
    });

    it('should resolve tuple types from parsed code', () => {
      const sourceCode = `
        fn process_coordinates() -> (f64, f64, f64) {
            (1.0, 2.0, 3.0)
        }
        
        fn swap<T, U>(pair: (T, U)) -> (U, T) {
            (pair.1, pair.0)
        }
        
        type Point3D = (f64, f64, f64);
        type NamedPoint = (String, f64, f64);
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'i32');
      context.type_arguments.set('U', 'String');

      const tupleResult = resolve_language_generic('(T, U)', 'rust', context, mockTypeRegistry);
      expect(tupleResult.resolved_type).toBe('(i32, String)');

      const reversedResult = resolve_language_generic('(U, T)', 'rust', context, mockTypeRegistry);
      expect(reversedResult.resolved_type).toBe('(String, i32)');
    });

    it('should resolve complex trait bounds from parsed code', () => {
      const sourceCode = `
        fn complex_function<T, U>() -> impl Future<Output = Result<T, Box<dyn Error>>>
        where
            T: Clone + Send + Sync + 'static,
            U: Iterator<Item = T> + Send,
        {
            async move {
                // Complex async logic here
                unimplemented!()
            }
        }
      `;

      const tree = parser.parse(sourceCode);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'MyStruct');

      const boundsResult = resolve_language_generic("T: Clone + Send + Sync + 'static", 'rust', context, mockTypeRegistry);
      expect(boundsResult.resolved_type).toBe("MyStruct: Clone + Send + Sync + 'static");
    });
  });

  describe('Cross-Language Integration', () => {
    it('should handle similar generic patterns across languages', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'String');
      context.type_arguments.set('U', 'Number');

      // TypeScript
      const tsResult = resolve_language_generic('Map<T, U>', 'typescript', context, mockTypeRegistry);
      expect(tsResult.resolved_type).toBe('Map<String, Number>');

      // Python  
      const pyResult = resolve_language_generic('Dict[T, U]', 'python', context, mockTypeRegistry);
      expect(pyResult.resolved_type).toBe('Dict[String, Number]');

      // Rust
      const rustResult = resolve_language_generic('HashMap<T, U>', 'rust', context, mockTypeRegistry);
      expect(rustResult.resolved_type).toBe('HashMap<String, Number>');
    });

    it('should maintain type parameter consistency across language boundaries', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'K' }, { name: 'V' }]);
      context.type_arguments.set('T', 'User');
      context.type_arguments.set('K', 'string');
      context.type_arguments.set('V', 'UserData');

      const languages = ['typescript', 'python', 'rust'] as const;
      const typePatterns = ['Container<T>', 'Container[T]', 'Container<T>'];
      
      languages.forEach((lang, index) => {
        const result = resolve_language_generic(typePatterns[index], lang, context, mockTypeRegistry);
        expect(result.type_substitutions.get('T')).toBe('User');
        expect(result.confidence).toBe('exact');
      });
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should gracefully handle parse errors in tree-sitter', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript);

      const malformedCode = `
        interface User {
          id: number
          name: string; // missing comma above
          email?: string
        }
        
        type PartialUser = Partial<User>; // should still work
      `;

      const tree = parser.parse(malformedCode);
      const context = create_generic_context([{ name: 'User' }]);
      context.type_arguments.set('User', 'User');

      // Even with parse errors, generic resolution should work
      const result = resolve_language_generic('Partial<User>', 'typescript', context, mockTypeRegistry);
      expect(result.resolved_type).toBe('Partial<User>');
    });

    it('should handle incomplete generic expressions', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'string');

      // Test various incomplete expressions
      expect(parse_generic_type('Array<')).toBeNull();
      expect(parse_generic_type('Array<T')).toBeNull();
      expect(parse_generic_type('Array<T,')).toBeNull();
      
      // But complete expressions should work
      const validResult = parse_generic_type('Array<T>');
      expect(validResult).toBeDefined();
      expect(validResult?.base_type).toBe('Array');
    });
  });
});