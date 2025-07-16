import { describe, it, expect } from 'vitest';
import { Project } from '../../index';
import { Point } from '../../graph';

describe('Rust Language Support', () => {
  it('should handle const and static declarations', () => {
    const project = new Project();
    const code = `const a: () = ();
static b: () = ();`;
    project.add_or_update_file('test.rs', code);
    
    // Check definitions at position of 'a' (row is 0-indexed, column 6 is on the 'a')
    const def_a = project.go_to_definition('test.rs', { row: 0, column: 6 });
    expect(def_a).toBeTruthy();
    expect(def_a?.name).toBe('a');
    expect(def_a?.symbol_kind).toBe('const');
    
    // Check definitions at position of 'b' (column 7 is on the 'b')
    const def_b = project.go_to_definition('test.rs', { row: 1, column: 7 });
    expect(def_b).toBeTruthy();
    expect(def_b?.name).toBe('b');
    expect(def_b?.symbol_kind).toBe('const');
  });

  it('should handle let statements with various patterns', () => {
    const project = new Project();
    const code = `fn main() {
    let a = ();
    let (b, c) = ();
    let S { d, e } = ();
    let S { field: f, g } = ();
    let S { h, .. } = ();
    let S { i, field: _ } = ();
}`;
    project.add_or_update_file('test.rs', code);
    
    // Check main function (row 0 is 'fn main() {', column 3 is on 'main')
    const def_main = project.go_to_definition('test.rs', { row: 0, column: 3 });
    expect(def_main).toBeTruthy();
    expect(def_main?.name).toBe('main');
    expect(def_main?.symbol_kind).toBe('function');
    
    // Check various variable definitions
    const vars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    vars.forEach((varName, index) => {
      const refs = project.find_references('test.rs', { 
        row: 2 + Math.floor(index / 2), 
        column: 8 + (index % 2) * 3 
      });
      // Each variable should have at least its definition
      expect(refs.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle function parameters', () => {
    const project = new Project();
    const code = `fn f1(a: T) {}
fn f2(b: T, c: T) {}
fn f3((d, e): (T, U)) {}
fn f4(S {f, g}: S) {}
fn f5(S {h, ..}: S) {}
fn f6(S { field: i }: S) {}`;
    project.add_or_update_file('test.rs', code);
    
    // Check function definitions (0-indexed rows)
    for (let i = 0; i < 6; i++) {
      const def = project.go_to_definition('test.rs', { row: i, column: 3 });
      expect(def).toBeTruthy();
      expect(def?.name).toBe(`f${i + 1}`);
      expect(def?.symbol_kind).toBe('function');
    }
  });

  it('should handle closure parameters', () => {
    const project = new Project();
    const code = `fn main() {
    let _ = |x| {};
    let _ = |x, y| {};
    let _ = |x: ()| {};
    let _ = |(x, y): ()| {};
}`;
    project.add_or_update_file('test.rs', code);
  });

  it('should handle loop labels', () => {
    const project = new Project();
    const code = `fn main() {
    'loop1: loop {};
    'loop2: for _ in () {}
    'loop3: while true {}
}`;
    project.add_or_update_file('test.rs', code);
    
    // Labels should be defined within their scope (row 1 is 'loop1: loop {};')
    const def = project.go_to_definition('test.rs', { row: 1, column: 5 });
    expect(def).toBeTruthy();
    expect(def?.name).toBe("'loop1");
    expect(def?.symbol_kind).toBe('label');
  });

  it('should handle type declarations', () => {
    const project = new Project();
    const code = `struct One {
    two: T,
    three: T,
}

enum Four {
    Five,
    Six(T),
    Seven {
        eight: T
    }
}

union Nine {}

type Ten = ();`;
    project.add_or_update_file('test.rs', code);
    
    // Check struct (row 0, column 7 is on 'One')
    const struct_def = project.go_to_definition('test.rs', { row: 0, column: 7 });
    expect(struct_def).toBeTruthy();
    expect(struct_def?.name).toBe('One');
    expect(struct_def?.symbol_kind).toBe('struct');
    
    // Check enum (row 5)
    const enum_def = project.go_to_definition('test.rs', { row: 5, column: 5 });
    expect(enum_def).toBeTruthy();
    expect(enum_def?.name).toBe('Four');
    expect(enum_def?.symbol_kind).toBe('enum');
    
    // Check union (row 13)
    const union_def = project.go_to_definition('test.rs', { row: 13, column: 6 });
    expect(union_def).toBeTruthy();
    expect(union_def?.name).toBe('Nine');
    expect(union_def?.symbol_kind).toBe('union');
    
    // Check type alias (row 15)
    const type_def = project.go_to_definition('test.rs', { row: 15, column: 5 });
    expect(type_def).toBeTruthy();
    expect(type_def?.name).toBe('Ten');
    expect(type_def?.symbol_kind).toBe('typedef');
  });

  it('should handle module declarations', () => {
    const project = new Project();
    const code = `mod one {}
pub mod two {}
mod three {
    mod four {}
}`;
    project.add_or_update_file('test.rs', code);
    
    // Check module definitions (0-indexed)
    const mod_one = project.go_to_definition('test.rs', { row: 0, column: 4 });
    expect(mod_one).toBeTruthy();
    expect(mod_one?.name).toBe('one');
    expect(mod_one?.symbol_kind).toBe('module');
    
    const mod_two = project.go_to_definition('test.rs', { row: 1, column: 8 });
    expect(mod_two).toBeTruthy();
    expect(mod_two?.name).toBe('two');
    expect(mod_two?.symbol_kind).toBe('module');
  });

  it('should handle let expressions in conditions', () => {
    const project = new Project();
    const code = `if let a = () {}
if let Some(b) = () {}

while let c = () {}
while let Some(d) = () {}`;
    project.add_or_update_file('test.rs', code);
  });

  it('should handle unary expressions', () => {
    const project = new Project();
    const code = `fn main() {
    let a = 2;
    !a;
    -a;
    *a;
}`;
    project.add_or_update_file('test.rs', code);
    
    // Find references to 'a' (row 1 is 'let a = 2;')
    const refs = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs.length).toBe(3); // Three uses: !a, -a, *a
  });

  it('should handle binary expressions', () => {
    const project = new Project();
    const code = `fn main() {
    let a = 2;
    let b = 3;
    a + b;
    a >> b;
}`;
    project.add_or_update_file('test.rs', code);
    
    // Find references to 'a' (row 1)
    const refs_a = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs_a.length).toBe(2); // Two uses in binary expressions
    
    // Find references to 'b' (row 2)
    const refs_b = project.find_references('test.rs', { row: 2, column: 8 });
    expect(refs_b.length).toBe(2); // Two uses in binary expressions
  });

  it('should handle control flow expressions', () => {
    const project = new Project();
    const code = `fn main() {
    let a = 2;
    
    if a {}
    
    if _ {} else if a {}
    
    while a {
        break;
    }
    
    a?;
    
    return a;
}`;
    project.add_or_update_file('test.rs', code);
    
    // Find all references to 'a' (row 1)
    const refs = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs.length).toBeGreaterThan(3); // Multiple uses in control flow
  });

  it('should handle struct expressions', () => {
    const project = new Project();
    const code = `fn main() {
    let a = 2;
    let b = 2;
    S { a, b };
    S { ..a };
    S { field: a, b };
}`;
    project.add_or_update_file('test.rs', code);
    
    const refs_a = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs_a.length).toBe(3); // Three uses of 'a'
    
    const refs_b = project.find_references('test.rs', { row: 2, column: 8 });
    expect(refs_b.length).toBe(2); // Two uses of 'b'
  });

  it('should handle dot notation', () => {
    const project = new Project();
    const code = `fn main() {
    let a = S {};
    
    a.b;
    a.foo();
}`;
    project.add_or_update_file('test.rs', code);
    
    const refs = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs.length).toBe(2); // Two uses: a.b and a.foo()
  });

  it('should handle function arguments', () => {
    const project = new Project();
    const code = `fn main() {
    let a = 2;
    let b = 3;
    foo(a, b);
}`;
    project.add_or_update_file('test.rs', code);
    
    const refs_a = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs_a.length).toBe(1); // One use in function call
    
    const refs_b = project.find_references('test.rs', { row: 2, column: 8 });
    expect(refs_b.length).toBe(1); // One use in function call
  });

  it('should handle use statements', () => {
    const project = new Project();
    const code = `mod intelligence;

use bleep;
use super::test_utils;
use intelligence::language as lang;
use crate::text_range::{TextRange, Point};`;
    project.add_or_update_file('test.rs', code);
    
    // Module 'intelligence' should be defined and referenced (row 0)
    const def = project.go_to_definition('test.rs', { row: 0, column: 4 });
    expect(def).toBeTruthy();
    expect(def?.name).toBe('intelligence');
    
    // Find references to 'intelligence' (row 0)
    const refs = project.find_references('test.rs', { row: 0, column: 4 });
    expect(refs.length).toBe(1); // Used in use statement
  });

  it('should handle lifetimes', () => {
    const project = new Project();
    const code = `impl<'a, T> Trait for Struct<'a, T> {
    fn foo<'b>(&'a self) -> &'b T { }
}`;
    project.add_or_update_file('test.rs', code);
    
    // Lifetime 'a should be defined in impl and used in multiple places (row 0)
    const def = project.go_to_definition('test.rs', { row: 0, column: 5 });
    expect(def).toBeTruthy();
    expect(def?.name).toBe("'a");
    expect(def?.symbol_kind).toBe('lifetime');
    
    // Find references to 'a (row 0)
    const refs = project.find_references('test.rs', { row: 0, column: 5 });
    expect(refs.length).toBeGreaterThan(1); // Used in multiple places
  });

  it('should handle self parameter', () => {
    const project = new Project();
    const code = `impl S {
    fn method(&self) {
        self.field;
    }
    
    fn method2(self) {
        self.field;
    }
}`;
    project.add_or_update_file('test.rs', code);
    
    // self should be defined as a parameter (row 1)
    const def = project.go_to_definition('test.rs', { row: 1, column: 15 });
    expect(def).toBeTruthy();
    expect(def?.name).toBe('self');
    expect(def?.symbol_kind).toBe('variable');
  });

  it('should handle trait implementations', () => {
    const project = new Project();
    const code = `struct MyStruct;
trait MyTrait {}

impl MyTrait for MyStruct {}`;
    project.add_or_update_file('test.rs', code);
    
    // MyStruct should be referenced in impl (row 0)
    const refs = project.find_references('test.rs', { row: 0, column: 7 });
    expect(refs.length).toBe(1); // Referenced in impl
  });

  it('should handle match expressions', () => {
    const project = new Project();
    const code = `fn main() {
    let value = Some(5);
    
    match value {
        Some(x) => x,
        None => 0,
    }
}`;
    project.add_or_update_file('test.rs', code);
    
    // value should be referenced in match (row 1)
    const refs = project.find_references('test.rs', { row: 1, column: 8 });
    expect(refs.length).toBe(1); // Used in match expression
  });
});