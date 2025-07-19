import { describe, test, expect, beforeEach } from 'vitest';
import { Def, Import, Project, Ref } from '../index';
import { 
  generateLanguageTests, 
  runLanguageSpecificTests,
  LanguageSpecificTest 
} from './shared-language-tests';

// Generate shared tests for JavaScript
generateLanguageTests('javascript', () => 'js');

// JavaScript-specific tests
const javaScriptSpecificTests: LanguageSpecificTest[] = [
  {
    name: 'Hoisting - var declarations',
    code: `console.log(x); // undefined, not error
var x = 5;
console.log(x); // 5`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      // var declaration should be found
      const xDef = defs.find(d => d.name === 'x');
      expect(xDef).toBeDefined();
      expect(xDef!.symbol_kind).toBe('variable');
      
      // References should include both console.log calls
      const refs = graph!.getNodes<Ref>('reference');
      const xRefs = refs.filter(r => r.name === 'x');
      expect(xRefs.length).toBe(2);
    }
  },
  
  {
    name: 'Function hoisting',
    code: `greet(); // Works due to hoisting

function greet() {
  console.log("Hello!");
}

greet(); // Also works`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      // Function should be defined
      const greetDef = defs.find(d => d.name === 'greet');
      expect(greetDef).toBeDefined();
      expect(greetDef!.symbol_kind).toBe('function');
      
      // Both calls should be references
      const refs = graph!.getNodes<Ref>('reference');
      const greetRefs = refs.filter(r => r.name === 'greet');
      expect(greetRefs.length).toBe(2);
    }
  },
  
  {
    name: 'Object destructuring',
    code: `const person = { name: 'John', age: 30, city: 'NYC' };
const { name, age } = person;
console.log(name, age);`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      // Should find destructured variables
      const nameDef = defs.find(d => d.name === 'name');
      expect(nameDef).toBeDefined();
      expect(nameDef!.symbol_kind).toBe('constant');
      
      const ageDef = defs.find(d => d.name === 'age');
      expect(ageDef).toBeDefined();
      expect(ageDef!.symbol_kind).toBe('constant');
    }
  },
  
  {
    name: 'Array destructuring with rest',
    code: `const numbers = [1, 2, 3, 4, 5];
const [first, second, ...rest] = numbers;
console.log(first, second, rest);`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      // Should find all destructured variables
      expect(defs.find(d => d.name === 'first')).toBeDefined();
      expect(defs.find(d => d.name === 'second')).toBeDefined();
      expect(defs.find(d => d.name === 'rest')).toBeDefined();
    }
  },
  
  {
    name: 'Generator functions',
    code: `function* numberGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

const gen = numberGenerator();
const first = gen.next();`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      // Should find generator function
      const genFunc = defs.find(d => d.name === 'numberGenerator');
      expect(genFunc).toBeDefined();
      expect(genFunc!.symbol_kind).toBe('generator');
    }
  },
  
  {
    name: 'This binding in methods',
    code: `const obj = {
  name: 'MyObject',
  greet: function() {
    console.log(this.name);
  },
  greetArrow: () => {
    console.log(this.name);
  }
};

obj.greet();
obj.greetArrow();`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      // Should find object and its methods
      const objDef = defs.find(d => d.name === 'obj');
      expect(objDef).toBeDefined();
      
      // Note: 'greet' and 'greetArrow' might be properties rather than separate definitions
      // depending on the parser implementation
    }
  },
  
  {
    name: 'CommonJS exports and require',
    code: `const fs = require('fs');
const { readFile } = require('fs/promises');

module.exports = {
  readData: function() {
    return readFile('./data.txt');
  }
};`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const imports = graph!.getNodes<Import>('import');
      
      // CommonJS require creates import nodes, like ES6 imports
      const fsImport = imports.find(d => d.name === 'fs');
      expect(fsImport).toBeDefined();
      
      const readFileImport = imports.find(d => d.name === 'readFile');
      expect(readFileImport).toBeDefined();
    }
  },

  // Function metadata tests
  {
    name: 'Async Function Metadata',
    code: `async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
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
      const defs = graph!.getNodes<Def>('definition');
      
      // testHelper should be marked as test function due to name
      const testHelper = defs.find(d => d.name === 'testHelper');
      expect(testHelper).toBeDefined();
      expect(testHelper!.metadata!.is_test).toBe(true);
    }
  },

  {
    name: 'Class Method Metadata',
    code: `class UserService {
  #privateField = 'secret';
  
  async getUser(id) {
    const response = await fetch(\`/users/\${id}\`);
    return response.json();
  }
  
  #validateId(id) {
    return id.length > 0;
  }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      const getUserMethod = defs.find(d => d.name === 'getUser');
      expect(getUserMethod).toBeDefined();
      expect(getUserMethod!.metadata).toBeDefined();
      expect(getUserMethod!.metadata!.is_async).toBe(true);
      expect(getUserMethod!.metadata!.class_name).toBe('UserService');
      expect(getUserMethod!.metadata!.parameter_names).toEqual(['id']);
      
      const validateMethod = defs.find(d => d.name === '#validateId');
      expect(validateMethod).toBeDefined();
      expect(validateMethod!.metadata).toBeDefined();
      expect(validateMethod!.metadata!.is_private).toBe(true);
      expect(validateMethod!.metadata!.class_name).toBe('UserService');
    }
  },

  {
    name: 'Rest Parameters',
    code: `function sum(...numbers) {
  return numbers.reduce((a, b) => a + b, 0);
}

function greet(greeting, ...names) {
  return \`\${greeting} \${names.join(', ')}\`;
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def> ('definition');
      
      const sumFunc = defs.find(d => d.name === 'sum');
      expect(sumFunc).toBeDefined();
      expect(sumFunc!.metadata!.parameter_names).toEqual(['...numbers']);
      
      const greetFunc = defs.find(d => d.name === 'greet');
      expect(greetFunc).toBeDefined();
      expect(greetFunc!.metadata!.parameter_names).toEqual(['greeting', '...names']);
    }
  },

  {
    name: 'Generator Function Metadata',
    code: `function* numberGenerator(start, end) {
  for (let i = start; i <= end; i++) {
    yield i;
  }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes<Def>('definition');
      
      const genFunc = defs.find(d => d.name === 'numberGenerator' && d.symbol_kind === 'generator');
      expect(genFunc).toBeDefined();
      expect(genFunc!.metadata).toBeDefined();
      expect(genFunc!.metadata!.line_count).toBe(5);
      expect(genFunc!.metadata!.parameter_names).toEqual(['start', 'end']);
    }
  }
];

runLanguageSpecificTests('JavaScript', javaScriptSpecificTests, () => 'js');