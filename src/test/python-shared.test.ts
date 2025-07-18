import { describe, test, expect, beforeEach } from 'vitest';
import { Project } from '../index';
import { 
  generateLanguageTests, 
  runLanguageSpecificTests,
  LanguageSpecificTest 
} from './shared-language-tests';

// Generate shared tests for Python
generateLanguageTests('python', () => 'py');

// Python-specific tests
const pythonSpecificTests: LanguageSpecificTest[] = [
  {
    name: 'Decorators',
    code: `def logger(func):
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@logger
def greet(name):
    return f"Hello, {name}!"

result = greet("World")`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find both functions
      const loggerDef = defs.find(d => d.name === 'logger');
      expect(loggerDef).toBeDefined();
      expect(loggerDef!.symbol_kind).toBe('function');
      
      const greetDef = defs.find(d => d.name === 'greet');
      expect(greetDef).toBeDefined();
      
      // Should find decorator reference
      const refs = graph!.getNodes('reference');
      const loggerRef = refs.find(r => r.name === 'logger');
      expect(loggerRef).toBeDefined();
    }
  },
  
  {
    name: 'List Comprehensions',
    code: `numbers = [1, 2, 3, 4, 5]
squares = [n * n for n in numbers if n % 2 == 0]
print(squares)`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find the comprehension variable
      const nDef = defs.find(d => d.name === 'n');
      expect(nDef).toBeDefined();
      
      // The 'n' in comprehension should have its own scope
      const refs = graph!.getNodes('reference');
      const nRefs = refs.filter(r => r.name === 'n');
      expect(nRefs.length).toBeGreaterThan(0);
    }
  },
  
  {
    name: 'Walrus Operator',
    code: `import re

if match := re.search(r'\\d+', 'The answer is 42'):
    print(f"Found: {match.group()}")
    
print(match)  # match is still in scope`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find the walrus assignment
      const matchDef = defs.find(d => d.name === 'match');
      expect(matchDef).toBeDefined();
      expect(matchDef!.symbol_kind).toBe('variable');
      
      // Should find references to match
      const refs = graph!.getNodes('reference');
      const matchRefs = refs.filter(r => r.name === 'match');
      expect(matchRefs.length).toBeGreaterThan(0);
    }
  },
  
  {
    name: 'Global and Nonlocal',
    code: `global_var = 10

def outer():
    outer_var = 20
    
    def inner():
        nonlocal outer_var
        global global_var
        
        outer_var = 30
        global_var = 40
    
    inner()
    return outer_var

result = outer()`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find global and nonlocal declarations
      const globalDefs = defs.filter(d => d.name === 'global_var');
      expect(globalDefs.length).toBeGreaterThan(0);
      
      const outerVarDefs = defs.filter(d => d.name === 'outer_var');
      expect(outerVarDefs.length).toBeGreaterThan(0);
    }
  }
];

runLanguageSpecificTests('Python', pythonSpecificTests, () => 'py');