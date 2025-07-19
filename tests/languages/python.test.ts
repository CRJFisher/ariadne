import { Project } from '../../src/index';
import { describe, test, expect, beforeEach } from 'vitest';

describe('Python language support', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('basic function definitions and parameters', () => {
    const code = `
def increment(value, by=1):
    value += by

def main():
    a = 5
    b = 3

    increment(a)
    increment(a, by=b)

main()
`;
    project.add_or_update_file('test.py', code);

    // Test function definitions
    const increment_def = project.go_to_definition('test.py', { row: 8, column: 4 });
    expect(increment_def).toBeTruthy();
    expect(increment_def?.name).toBe('increment');
    expect(increment_def?.range.start.row).toBe(1);
    expect(increment_def?.range.start.column).toBe(4);

    const main_def = project.go_to_definition('test.py', { row: 11, column: 0 });
    expect(main_def).toBeTruthy();
    expect(main_def?.name).toBe('main');
    expect(main_def?.range.start.row).toBe(4);
    expect(main_def?.range.start.column).toBe(4);

    // Test parameter references
    const value_refs = project.find_references('test.py', { row: 1, column: 14 });
    expect(value_refs.length).toBe(1);
    expect(value_refs[0].range.start.row).toBe(2);
    expect(value_refs[0].range.start.column).toBe(4);

    // Test variable references
    const a_refs = project.find_references('test.py', { row: 5, column: 4 });
    expect(a_refs.length).toBe(2);
    expect(a_refs[0].range.start.row).toBe(8);
    expect(a_refs[0].range.start.column).toBe(14);
    expect(a_refs[1].range.start.row).toBe(9);
    expect(a_refs[1].range.start.column).toBe(14);
  });

  test('imports and type annotations', () => {
    const code = `
from typing import List
import math

def sines(items: List[int]) -> List[int]:
    return [math.sin(item) for item in items]

list = [1, 2, 3]
sines(list)
`;
    project.add_or_update_file('test.py', code);

    // Test imports - List is imported on row 1
    // Since List is an import, we need to find references from the import position
    const List_refs = project.find_references('test.py', { row: 1, column: 19 });
    expect(List_refs.length).toBe(2);
    expect(List_refs[0].range.start.row).toBe(4);
    expect(List_refs[0].range.start.column).toBe(17);
    expect(List_refs[1].range.start.row).toBe(4);
    expect(List_refs[1].range.start.column).toBe(31);

    const math_refs = project.find_references('test.py', { row: 2, column: 7 });
    expect(math_refs.length).toBe(1);
    expect(math_refs[0].range.start.row).toBe(5);
    expect(math_refs[0].range.start.column).toBe(12);

    // Test list comprehension scope
    const item_def = project.go_to_definition('test.py', { row: 5, column: 21 });
    expect(item_def).toBeTruthy();
    expect(item_def?.name).toBe('item');
    expect(item_def?.range.start.row).toBe(5);
    expect(item_def?.range.start.column).toBe(31);
  });

  test('class definitions and methods', () => {
    const code = `
class Foo():
    def bar(self):
        return self

def main():
    a = Foo()
`;
    project.add_or_update_file('test.py', code);

    // Test class definition
    const Foo_def = project.go_to_definition('test.py', { row: 6, column: 8 });
    expect(Foo_def).toBeTruthy();
    expect(Foo_def?.name).toBe('Foo');
    expect(Foo_def?.symbol_kind).toBe('class');
    expect(Foo_def?.range.start.row).toBe(1);
    expect(Foo_def?.range.start.column).toBe(6);

    // Test self parameter
    const self_refs = project.find_references('test.py', { row: 2, column: 12 });
    expect(self_refs.length).toBe(1);
    expect(self_refs[0].range.start.row).toBe(3);
    expect(self_refs[0].range.start.column).toBe(15);
  });

  test('lambda functions and circular references', () => {
    const code = `
fix = lambda f: fix(f)
`;
    project.add_or_update_file('test.py', code);

    // Test lambda parameter
    const f_def = project.go_to_definition('test.py', { row: 1, column: 20 });
    expect(f_def).toBeTruthy();
    expect(f_def?.name).toBe('f');
    expect(f_def?.symbol_kind).toBe('parameter');

    // Test circular reference
    const fix_refs = project.find_references('test.py', { row: 1, column: 0 });
    expect(fix_refs.length).toBe(1);
    expect(fix_refs[0].range.start.row).toBe(1);
    expect(fix_refs[0].range.start.column).toBe(16);
  });

  test('decorators', () => {
    const code = `
from module import decor

@decor
def foo():
    pass
`;
    project.add_or_update_file('test.py', code);

    // Test decorator reference
    const decor_refs = project.find_references('test.py', { row: 1, column: 19 });
    expect(decor_refs.length).toBe(1);
    expect(decor_refs[0].range.start.row).toBe(3);
    expect(decor_refs[0].range.start.column).toBe(1);
  });

  test('type aliases', () => {
    const code = `
MyType = List[int]

def foo(t: MyType) -> MyType:
    a: MyType = [1, 2, 3]
`;
    project.add_or_update_file('test.py', code);

    // Test type alias references
    const MyType_refs = project.find_references('test.py', { row: 1, column: 0 });
    expect(MyType_refs.length).toBe(3);
    expect(MyType_refs[0].range.start.row).toBe(3);
    expect(MyType_refs[0].range.start.column).toBe(11);
    expect(MyType_refs[1].range.start.row).toBe(3);
    expect(MyType_refs[1].range.start.column).toBe(22);
    expect(MyType_refs[2].range.start.row).toBe(4);
    expect(MyType_refs[2].range.start.column).toBe(7);
  });

  test('global and nonlocal keywords', () => {
    const code = `
x = 1

def outer():
    x = 2
    def inner():
        global x
        x = 3
`;
    project.add_or_update_file('test.py', code);

    // Test global variable definition
    // The global statement creates a definition in Python
    const global_x = project.go_to_definition('test.py', { row: 7, column: 8 });
    expect(global_x).toBeTruthy();
    // The global statement creates a variable definition at the global statement location
    expect(global_x?.range.start.row).toBe(7);
    expect(global_x?.range.start.column).toBe(8);
    expect(global_x?.symbol_kind).toBe('variable');
  });

  test('various Python-specific constructs', () => {
    const code = `
# Test walrus operator
if (n := len([1, 2, 3])) > 0:
    print(n)

# Test pattern matching
a, *rest = [1, 2, 3, 4]
{k: v, **others} = {"a": 1, "b": 2}

# Test with statement
with open("file.txt") as f:
    content = f.read()

# Test dictionary comprehension
squares = {x: x**2 for x in range(10)}
`;
    project.add_or_update_file('test.py', code);

    // Test walrus operator
    const n_refs = project.find_references('test.py', { row: 2, column: 4 });
    expect(n_refs.length).toBe(1);
    expect(n_refs[0].range.start.row).toBe(3);
    expect(n_refs[0].range.start.column).toBe(10);

    // Test pattern matching
    const rest_def = project.go_to_definition('test.py', { row: 6, column: 4 });
    expect(rest_def).toBeTruthy();
    expect(rest_def?.name).toBe('rest');

    // Test with statement
    const f_refs = project.find_references('test.py', { row: 10, column: 25 });
    expect(f_refs.length).toBe(1);
    expect(f_refs[0].range.start.row).toBe(11);
    expect(f_refs[0].range.start.column).toBe(14);

    // Test dictionary comprehension
    const x_def_in_comp = project.go_to_definition('test.py', { row: 14, column: 11 }); // x**2 - test the second x
    expect(x_def_in_comp).toBeTruthy();
    expect(x_def_in_comp?.range.start.row).toBe(14);
    expect(x_def_in_comp?.range.start.column).toBe(23);
  });
});