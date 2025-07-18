import { describe, test, expect, beforeEach } from 'vitest';
import { Project } from '../index';
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
      const defs = graph!.getNodes('definition');
      
      // var declaration should be found
      const xDef = defs.find(d => d.name === 'x');
      expect(xDef).toBeDefined();
      expect(xDef!.symbol_kind).toBe('variable');
      
      // References should include both console.log calls
      const refs = graph!.getNodes('reference');
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
      const defs = graph!.getNodes('definition');
      
      // Function should be defined
      const greetDef = defs.find(d => d.name === 'greet');
      expect(greetDef).toBeDefined();
      expect(greetDef!.symbol_kind).toBe('function');
      
      // Both calls should be references
      const refs = graph!.getNodes('reference');
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
      const defs = graph!.getNodes('definition');
      
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
      const defs = graph!.getNodes('definition');
      
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
      const defs = graph!.getNodes('definition');
      
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
      const defs = graph!.getNodes('definition');
      
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
      const defs = graph!.getNodes('definition');
      const imports = graph!.getNodes('import');
      
      // CommonJS require creates import nodes, like ES6 imports
      const fsImport = imports.find(d => d.name === 'fs');
      expect(fsImport).toBeDefined();
      
      const readFileImport = imports.find(d => d.name === 'readFile');
      expect(readFileImport).toBeDefined();
    }
  }
];

runLanguageSpecificTests('JavaScript', javaScriptSpecificTests, () => 'js');