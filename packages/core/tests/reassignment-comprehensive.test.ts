import { describe, test, expect } from 'vitest';
import { Project } from '../src/index';

describe('Variable reassignment comprehensive tests', () => {
  test('multiple reassignments in sequence', () => {
    const code = `
class A {
  methodA() { return "A"; }
}

class B {
  methodB() { return "B"; }
}

class C {
  methodC() { return "C"; }
}

function test() {
  let obj = new A();
  obj.methodA(); // Should resolve to A.methodA
  
  obj = new B();
  obj.methodB(); // Should resolve to B.methodB
  obj.methodA(); // Should NOT resolve (B doesn't have methodA)
  
  obj = new C();
  obj.methodC(); // Should resolve to C.methodC
  obj.methodB(); // Should NOT resolve (C doesn't have methodB)
}
    `;

    const project = new Project();
    project.add_or_update_file('test.js', code);
    
    const functions = project.get_functions_in_file('test.js');
    const testFunc = functions.find(f => f.name === 'test');
    expect(testFunc).toBeDefined();
    
    const calls = project.get_function_calls(testFunc!);
    
    const methodACalls = calls.filter(c => c.called_def.name === 'methodA');
    const methodBCalls = calls.filter(c => c.called_def.name === 'methodB');
    const methodCCalls = calls.filter(c => c.called_def.name === 'methodC');
    
    expect(methodACalls.length).toBe(1); // Only first call resolves
    expect(methodBCalls.length).toBe(1); // Only middle call resolves
    expect(methodCCalls.length).toBe(1); // Only last call resolves
  });

  test('reassignment in different scopes', () => {
    const code = `
class Foo {
  foo() { return "foo"; }
}

class Bar {
  bar() { return "bar"; }
}

function test() {
  let obj = new Foo();
  obj.foo(); // Should resolve
  
  if (true) {
    obj = new Bar();
    obj.bar(); // Should resolve
    obj.foo(); // Should NOT resolve
  }
  
  // Outside the if block, obj is still Bar
  obj.bar(); // Should resolve (reassignment persists)
}
    `;

    const project = new Project();
    project.add_or_update_file('test.js', code);
    
    const functions = project.get_functions_in_file('test.js');
    const testFunc = functions.find(f => f.name === 'test');
    const calls = project.get_function_calls(testFunc!);
    
    const fooCalls = calls.filter(c => c.called_def.name === 'foo');
    const barCalls = calls.filter(c => c.called_def.name === 'bar');
    
    expect(fooCalls.length).toBe(1); // Only first call resolves
    expect(barCalls.length).toBe(2); // Both bar() calls resolve
  });

  test('parameter reassignment', () => {
    const code = `
class Original {
  original() { return "original"; }
}

class Replacement {
  replacement() { return "replacement"; }
}

function process(obj) {
  obj.original(); // May or may not resolve depending on type inference
  
  obj = new Replacement();
  obj.replacement(); // Should resolve
  obj.original(); // Should NOT resolve
}
    `;

    const project = new Project();
    project.add_or_update_file('test.js', code);
    
    const functions = project.get_functions_in_file('test.js');
    const processFunc = functions.find(f => f.name === 'process');
    const calls = project.get_function_calls(processFunc!);
    
    const replacementCalls = calls.filter(c => c.called_def.name === 'replacement');
    
    // At minimum, the replacement() call after reassignment should resolve
    expect(replacementCalls.length).toBe(1);
  });
});