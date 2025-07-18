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
  },

  // Function metadata tests
  {
    name: 'Async Function Metadata',
    code: `async def fetch_data(url):
    response = await session.get(url)
    return response.json()`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const funcDef = defs.find(d => d.name === 'fetch_data' && d.symbol_kind === 'function');
      expect(funcDef).toBeDefined();
      expect(funcDef!.metadata).toBeDefined();
      expect(funcDef!.metadata!.is_async).toBe(true);
      expect(funcDef!.metadata!.line_count).toBe(3);
      expect(funcDef!.metadata!.parameter_names).toEqual(['url']);
    }
  },

  {
    name: 'Test Function Detection',
    code: `def test_addition():
    assert add(2, 3) == 5

def test_subtraction():
    assert subtract(5, 3) == 2
    
class TestCalculator(unittest.TestCase):
    def test_multiply(self):
        self.assertEqual(multiply(3, 4), 12)
        
    def setUp(self):
        self.calc = Calculator()`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Functions starting with test_ should be marked as test
      const testAddition = defs.find(d => d.name === 'test_addition');
      expect(testAddition).toBeDefined();
      expect(testAddition!.metadata!.is_test).toBe(true);
      
      const testSubtraction = defs.find(d => d.name === 'test_subtraction');
      expect(testSubtraction).toBeDefined();
      expect(testSubtraction!.metadata!.is_test).toBe(true);
      
      // Class methods named test_* or setUp/tearDown should be marked as test
      const testMultiply = defs.find(d => d.name === 'test_multiply');
      expect(testMultiply).toBeDefined();
      expect(testMultiply!.metadata!.is_test).toBe(true);
      
      const setUp = defs.find(d => d.name === 'setUp');
      expect(setUp).toBeDefined();
      expect(setUp!.metadata!.is_test).toBe(true);
    }
  },

  {
    name: 'Private Function and Method Metadata',
    code: `def _private_function(x):
    return x * 2

class MyClass:
    def _private_method(self):
        return self._value
        
    def __init__(self, value):
        self._value = value`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const privateFunc = defs.find(d => d.name === '_private_function');
      expect(privateFunc).toBeDefined();
      expect(privateFunc!.metadata!.is_private).toBe(true);
      
      const privateMethod = defs.find(d => d.name === '_private_method');
      expect(privateMethod).toBeDefined();
      expect(privateMethod!.metadata!.is_private).toBe(true);
      expect(privateMethod!.metadata!.class_name).toBe('MyClass');
      
      const initMethod = defs.find(d => d.name === '__init__');
      expect(initMethod).toBeDefined();
      expect(initMethod!.metadata!.class_name).toBe('MyClass');
      expect(initMethod!.metadata!.parameter_names).toEqual(['self', 'value']);
    }
  },

  {
    name: 'Decorated Function Metadata',
    code: `@pytest.fixture
def database():
    return Database()

@lru_cache(maxsize=128)
def expensive_computation(n):
    return n ** 2`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const database = defs.find(d => d.name === 'database');
      expect(database).toBeDefined();
      expect(database!.metadata!.has_decorator).toBe(true);
      expect(database!.metadata!.is_test).toBe(true); // pytest decorator
      
      const computation = defs.find(d => d.name === 'expensive_computation');
      expect(computation).toBeDefined();
      expect(computation!.metadata!.has_decorator).toBe(true);
    }
  },

  {
    name: 'Parameter Types',
    code: `def greet(name, greeting='Hello', *titles, **kwargs):
    return f"{greeting} {' '.join(titles)} {name}"`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const greet = defs.find(d => d.name === 'greet');
      expect(greet).toBeDefined();
      expect(greet!.metadata!.parameter_names).toEqual(['name', 'greeting', '*titles', '**kwargs']);
    }
  }
];

runLanguageSpecificTests('Python', pythonSpecificTests, () => 'py');