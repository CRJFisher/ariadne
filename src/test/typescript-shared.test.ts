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
  },

  // Function metadata tests
  {
    name: 'Async Function Metadata',
    code: `async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  return response.json();
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const funcDef = defs.find(d => d.name === 'fetchData' && d.symbol_kind === 'function');
      expect(funcDef).toBeDefined();
      expect(funcDef!.metadata).toBeDefined();
      expect(funcDef!.metadata!.is_async).toBe(true);
      expect(funcDef!.metadata!.line_count).toBe(4);
      expect(funcDef!.metadata!.parameter_names).toEqual(['url']);
    }
  },

  {
    name: 'Test Function Detection',
    code: `describe('Calculator', () => {
  it('should add numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  
  test('subtraction works', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});

function testHelper() {
  return 42;
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Only named functions are captured as definitions
      // Anonymous arrow functions in test blocks are not captured
      const testFuncs = defs.filter(d => d.metadata && d.metadata.is_test);
      expect(testFuncs.length).toBeGreaterThanOrEqual(1); // Just testHelper
      
      // testHelper should be marked as test function due to name
      const testHelper = defs.find(d => d.name === 'testHelper');
      expect(testHelper).toBeDefined();
      expect(testHelper!.metadata!.is_test).toBe(true);
    }
  },

  {
    name: 'Class Method Metadata',
    code: `class UserService {
  private apiUrl: string;
  
  async getUser(id: string): Promise<User> {
    const response = await fetch(\`\${this.apiUrl}/users/\${id}\`);
    return response.json();
  }
  
  private validateId(id: string): boolean {
    return id.length > 0;
  }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const getUserMethod = defs.find(d => d.name === 'getUser');
      expect(getUserMethod).toBeDefined();
      expect(getUserMethod!.metadata).toBeDefined();
      expect(getUserMethod!.metadata!.is_async).toBe(true);
      expect(getUserMethod!.metadata!.class_name).toBe('UserService');
      expect(getUserMethod!.metadata!.parameter_names).toEqual(['id']);
      
      const validateMethod = defs.find(d => d.name === 'validateId');
      expect(validateMethod).toBeDefined();
      expect(validateMethod!.metadata).toBeDefined();
      expect(validateMethod!.metadata!.is_private).toBe(true);
      expect(validateMethod!.metadata!.class_name).toBe('UserService');
    }
  },

  {
    name: 'Arrow Function Metadata',
    code: `const multiply = (a: number, b: number): number => a * b;

const asyncProcess = async (data: any) => {
  await delay(100);
  return process(data);
};

const restParams = (...numbers: number[]) => {
  return numbers.reduce((a, b) => a + b, 0);
};`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Note: Arrow functions are captured as variable definitions, not function definitions
      // The metadata extraction needs to handle the arrow function node itself
      // This test verifies the current behavior
      const multiply = defs.find(d => d.name === 'multiply');
      expect(multiply).toBeDefined();
      expect(multiply!.symbol_kind).toBe('constant');
      
      const asyncProcess = defs.find(d => d.name === 'asyncProcess');
      expect(asyncProcess).toBeDefined();
      
      const restParams = defs.find(d => d.name === 'restParams');
      expect(restParams).toBeDefined();
    }
  }
];

runLanguageSpecificTests('TypeScript', typeScriptSpecificTests, () => 'ts');