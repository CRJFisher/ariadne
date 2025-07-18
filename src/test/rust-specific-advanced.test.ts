import { describe, test, expect } from 'vitest';
import { Project } from '../index';

describe('Rust - Advanced Language-Specific Features', () => {
  let project: Project;
  
  beforeEach(() => {
    project = new Project();
  });
  
  test('Closure parameters and captures', () => {
    const code = `fn main() {
    let x = 5;
    let closure = |y| x + y;
    let result = closure(10);
    
    let mut sum = 0;
    let mut accumulator = |n| {
        sum += n;
        sum
    };
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const defs = graph!.getNodes('definition');
    expect(defs.find(d => d.name === 'closure')).toBeDefined();
    expect(defs.find(d => d.name === 'y')).toBeDefined();
    expect(defs.find(d => d.name === 'accumulator')).toBeDefined();
    expect(defs.find(d => d.name === 'n')).toBeDefined();
  });
  
  test('if let and while let expressions', () => {
    const code = `fn main() {
    let opt = Some(42);
    
    if let Some(value) = opt {
        println!("Got value: {}", value);
    }
    
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("Popped: {}", top);
    }
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const defs = graph!.getNodes('definition');
    expect(defs.find(d => d.name === 'value')).toBeDefined();
    expect(defs.find(d => d.name === 'top')).toBeDefined();
  });
  
  test('Reference and dereference operators', () => {
    const code = `fn main() {
    let x = 5;
    let ref_x = &x;
    let ref_mut_x = &mut x;
    let deref_x = *ref_x;
    
    let boxed = Box::new(42);
    let unboxed = *boxed;
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const refs = graph!.getNodes('reference');
    // Should find references to x through & and * operators
    const xRefs = refs.filter(r => r.name === 'x');
    expect(xRefs.length).toBeGreaterThan(0);
  });
  
  test('Question mark operator', () => {
    const code = `fn might_fail() -> Result<i32, String> {
    let x = risky_operation()?;
    let y = another_operation()?;
    Ok(x + y)
}

fn main() -> Result<(), Box<dyn Error>> {
    let result = might_fail()?;
    println!("Result: {}", result);
    Ok(())
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const defs = graph!.getNodes('definition');
    expect(defs.find(d => d.name === 'x')).toBeDefined();
    expect(defs.find(d => d.name === 'y')).toBeDefined();
    expect(defs.find(d => d.name === 'result')).toBeDefined();
  });
  
  test('Struct expressions and field init shorthand', () => {
    const code = `struct Point {
    x: f32,
    y: f32,
}

fn main() {
    let x = 1.0;
    let y = 2.0;
    
    let p1 = Point { x: x, y: y };
    let p2 = Point { x, y };  // Field init shorthand
    let p3 = Point { x: 3.0, ..p1 };  // Struct update syntax
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const defs = graph!.getNodes('definition');
    expect(defs.find(d => d.name === 'p1')).toBeDefined();
    expect(defs.find(d => d.name === 'p2')).toBeDefined();
    expect(defs.find(d => d.name === 'p3')).toBeDefined();
    
    // Check references in struct expressions
    const refs = graph!.getNodes('reference');
    const xRefs = refs.filter(r => r.name === 'x');
    const yRefs = refs.filter(r => r.name === 'y');
    expect(xRefs.length).toBeGreaterThan(0);
    expect(yRefs.length).toBeGreaterThan(0);
  });
  
  test('Method calls and field access', () => {
    const code = `struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
    
    fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }
}

fn main() {
    let rect = Rectangle::new(10.0, 20.0);
    let area = rect.area();
    let w = rect.width;
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const refs = graph!.getNodes('reference');
    // Should find method calls and field access
    expect(refs.find(r => r.name === 'Rectangle')).toBeDefined();
    expect(refs.find(r => r.name === 'area')).toBeDefined();
    expect(refs.find(r => r.name === 'width')).toBeDefined();
  });
  
  test('Complex match patterns', () => {
    const code = `enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}

fn process(msg: Message) {
    match msg {
        Message::Quit => println!("Quit"),
        Message::Move { x, y } => println!("Move to {}, {}", x, y),
        Message::Write(text) => println!("Text: {}", text),
        Message::ChangeColor(r, g, b) => println!("RGB: {}, {}, {}", r, g, b),
    }
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const defs = graph!.getNodes('definition');
    // Pattern bindings in match arms
    expect(defs.find(d => d.name === 'x')).toBeDefined();
    expect(defs.find(d => d.name === 'y')).toBeDefined();
    expect(defs.find(d => d.name === 'text')).toBeDefined();
    expect(defs.find(d => d.name === 'r')).toBeDefined();
    expect(defs.find(d => d.name === 'g')).toBeDefined();
    expect(defs.find(d => d.name === 'b')).toBeDefined();
  });
  
  test('Use statements with complex paths', () => {
    const code = `use std::collections::{HashMap, HashSet};
use std::io::{self, Read, Write as IoWrite};
use super::module::{function, Type};
use crate::utils::*;

fn main() {
    let map: HashMap<String, i32> = HashMap::new();
    let set: HashSet<i32> = HashSet::new();
}`;
    
    const fileName = 'test.rs';
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);
    
    const imports = graph!.getNodes('import');
    expect(imports.find(i => i.name === 'HashMap')).toBeDefined();
    expect(imports.find(i => i.name === 'HashSet')).toBeDefined();
    expect(imports.find(i => i.name === 'Read')).toBeDefined();
    expect(imports.find(i => i.name === 'IoWrite')).toBeDefined();
  });
});