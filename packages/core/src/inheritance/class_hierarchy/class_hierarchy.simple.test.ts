import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import {
  ClassHierarchyContext,
  build_class_hierarchy,
} from './index';
import type { ClassDefinition } from '@ariadnejs/types';

describe('class_hierarchy - simplified tests', () => {
  it('should build basic hierarchy', () => {
    const definitions: ClassDefinition[] = [
      {
        name: 'Animal',
        file_path: 'test.js',
        location: {
          file_path: 'test.js',
          line: 1,
          column: 8,
          end_line: 3,
          end_column: 9
        },
        extends: [],
        implements: [],
        is_abstract: false,
        is_exported: true,
        methods: [],
        properties: [],
        generics: []
      },
      {
        name: 'Dog',
        file_path: 'test.js',
        location: {
          file_path: 'test.js',
          line: 4,
          column: 8,
          end_line: 6,
          end_column: 9
        },
        extends: ['Animal'],
        implements: [],
        is_abstract: false,
        is_exported: true,
        methods: [],
        properties: [],
        generics: []
      }
    ];

    const parser = new Parser();
    parser.setLanguage(JavaScript);
    const code = `
      class Animal {
        move() {}
      }
      class Dog extends Animal {
        bark() {}
      }
    `;
    const tree = parser.parse(code);

    const contexts = new Map<string, ClassHierarchyContext>();
    contexts.set('test.js', {
      tree,
      source_code: code,
      file_path: 'test.js',
      language: 'javascript'
    });
    
    const hierarchy = build_class_hierarchy(definitions, contexts);
    
    // Basic checks
    expect(hierarchy.classes.size).toBe(2);
    
    // Check qualified names
    const dogNode = hierarchy.classes.get('test.js#Dog');
    expect(dogNode).toBeDefined();
    expect(dogNode!.name).toBe('Dog');
    expect(dogNode!.base_classes).toEqual(['Animal']);
    
    const animalNode = hierarchy.classes.get('test.js#Animal');
    expect(animalNode).toBeDefined();
    expect(animalNode!.name).toBe('Animal');
    expect(animalNode!.base_classes).toEqual([]);
  });

  it('should handle interfaces', () => {
    const definitions: ClassDefinition[] = [
      {
        name: 'Flyable',
        file_path: 'test.ts',
        location: {
          file_path: 'test.ts',
          line: 1,
          column: 0,
          end_line: 3,
          end_column: 1
        },
        extends: [],
        implements: [],
        is_interface: true,
        is_exported: true,
        methods: [],
        properties: [],
        generics: []
      },
      {
        name: 'Bird',
        file_path: 'test.ts',
        location: {
          file_path: 'test.ts',
          line: 4,
          column: 0,
          end_line: 6,
          end_column: 1
        },
        extends: [],
        implements: ['Flyable'],
        is_abstract: false,
        is_exported: true,
        methods: [],
        properties: [],
        generics: []
      }
    ];

    const parser = new Parser();
    const tree = parser.parse(''); // Empty for now

    const contexts = new Map<string, ClassHierarchyContext>();
    contexts.set('test.ts', {
      tree,
      source_code: '',
      file_path: 'test.ts',
      language: 'typescript'
    });
    
    const hierarchy = build_class_hierarchy(definitions, contexts);
    
    const birdNode = hierarchy.classes.get('test.ts#Bird');
    expect(birdNode).toBeDefined();
    expect(birdNode!.interfaces).toEqual(['Flyable']);
  });
});