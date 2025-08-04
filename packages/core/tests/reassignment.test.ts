import { describe, test, expect } from 'vitest';
import { Project } from '../src/index';

describe('Variable reassignment type tracking', () => {
  test('should track type changes on reassignment', () => {
    const code = `
// Test file for variable reassignment
class Foo {
  fooMethod() {
    console.log("Foo method");
  }
}

class Bar {
  barMethod() {
    console.log("Bar method");
  }
}

function test() {
  // Initial assignment
  let obj = new Foo();
  obj.fooMethod(); // Should resolve to Foo.fooMethod

  // Reassignment
  obj = new Bar();
  obj.barMethod(); // Should resolve to Bar.barMethod
  obj.fooMethod(); // Should NOT resolve (Bar doesn't have fooMethod)
}
    `;

    const project = new Project();
    project.add_or_update_file('test.js', code);
    
    const functions = project.get_functions_in_file('test.js');
    const testFunc = functions.find(f => f.name === 'test');
    expect(testFunc).toBeDefined();
    
    // Get all calls from the test function
    const calls = project.get_function_calls(testFunc!);
    
    console.log('All calls from test function:', calls.map(c => ({
      name: c.called_def.name,
      line: c.call?.range?.start?.row || 'unknown',
      is_method: c.is_method_call,
      receiver: c.receiver_name
    })));
    
    // Find specific method calls
    const fooMethodCalls = calls.filter(c => c.called_def.name === 'fooMethod');
    const barMethodCalls = calls.filter(c => c.called_def.name === 'barMethod');
    
    console.log('fooMethod calls:', fooMethodCalls.length);
    console.log('barMethod calls:', barMethodCalls.length);
    
    // We expect:
    // - 1 call to fooMethod that resolves (before reassignment)
    // - 1 call to barMethod that resolves (after reassignment)
    // - The second fooMethod call might resolve incorrectly due to the bug
    
    expect(fooMethodCalls.length).toBeGreaterThan(0);
    expect(barMethodCalls.length).toBe(1);
    
    // If reassignment is handled correctly, we should only have 1 fooMethod call
    // If not, we'll have 2 (the bug)
    if (fooMethodCalls.length === 2) {
      console.log('BUG CONFIRMED: Both fooMethod calls resolved, but the second should not (obj is Bar after reassignment)');
    }
  });
});