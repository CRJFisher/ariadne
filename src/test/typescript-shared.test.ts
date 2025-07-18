import { describe, test, expect, beforeEach } from 'vitest';
import { Project } from '../index';
import { 
  generateLanguageTests, 
  runLanguageSpecificTests,
  LanguageSpecificTest 
} from './shared-language-tests';

// Generate shared tests for TypeScript
generateLanguageTests('typescript', () => 'ts');

// TypeScript-specific tests
const typeScriptSpecificTests: LanguageSpecificTest[] = [
  {
    name: 'Type Parameters in Functions',
    code: `function identity<T>(value: T): T {
  return value;
}

const result = identity<string>("hello");`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find the function and type parameter
      const funcDef = defs.find(d => d.name === 'identity');
      expect(funcDef).toBeDefined();
      expect(funcDef!.symbol_kind).toBe('function');
      
      // Type parameter T should be defined
      const typeParam = defs.find(d => d.name === 'T');
      expect(typeParam).toBeDefined();
    }
  },
  
  {
    name: 'Optional Parameters',
    code: `function greet(name: string, greeting?: string): string {
  return \`\${greeting || 'Hello'}, \${name}!\`;
}

greet("World");
greet("World", "Hi");`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find both parameters
      const params = defs.filter(d => d.symbol_kind === 'parameter');
      expect(params.length).toBe(2);
      expect(params.map(p => p.name)).toContain('greeting');
    }
  },
  
  {
    name: 'Type Aliases',
    code: `type Point = {
  x: number;
  y: number;
};

type Distance = number;

const p: Point = { x: 1, y: 2 };`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find type aliases
      const pointType = defs.find(d => d.name === 'Point');
      expect(pointType).toBeDefined();
      expect(pointType!.symbol_kind).toBe('alias');  // TypeScript uses 'alias' for type definitions
      
      const distanceType = defs.find(d => d.name === 'Distance');
      expect(distanceType).toBeDefined();
      expect(distanceType!.symbol_kind).toBe('alias');
    }
  }
];

runLanguageSpecificTests('TypeScript', typeScriptSpecificTests, () => 'ts');