import { describe, test, expect, beforeEach } from 'vitest';
import { Project } from '../index';
import { 
  generateLanguageTests, 
  runLanguageSpecificTests,
  LanguageSpecificTest 
} from './shared-language-tests';

// Generate shared tests for Rust
generateLanguageTests('rust', () => 'rs');

// Rust-specific tests
const rustSpecificTests: LanguageSpecificTest[] = [
  {
    name: 'Lifetime parameters',
    code: `fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}

fn main() {
    let result = longest("hello", "world");
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find function with lifetime parameter
      const longestDef = defs.find(d => d.name === 'longest');
      expect(longestDef).toBeDefined();
      expect(longestDef!.symbol_kind).toBe('function');
      
      // Should find lifetime parameter
      const lifetimeDef = defs.find(d => d.name === "'a");
      expect(lifetimeDef).toBeDefined();
    }
  },
  
  {
    name: 'Pattern matching in match expressions',
    code: `enum Color {
    Red,
    Green,
    Blue,
    Rgb(u8, u8, u8),
}

fn print_color(color: Color) {
    match color {
        Color::Red => println!("Red"),
        Color::Green => println!("Green"),
        Color::Blue => println!("Blue"),
        Color::Rgb(r, g, b) => println!("RGB({}, {}, {})", r, g, b),
    }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find enum and its variants
      const colorEnum = defs.find(d => d.name === 'Color');
      expect(colorEnum).toBeDefined();
      expect(colorEnum!.symbol_kind).toBe('enum');
      
      // Should find pattern bindings in match
      const rDef = defs.find(d => d.name === 'r');
      expect(rDef).toBeDefined();
    }
  },
  
  {
    name: 'Trait definitions and implementations',
    code: `trait Display {
    fn fmt(&self) -> String;
}

struct Point {
    x: i32,
    y: i32,
}

impl Display for Point {
    fn fmt(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find trait definition (parsed as 'interface' in tree-sitter)
      const displayTrait = defs.find(d => d.name === 'Display');
      expect(displayTrait).toBeDefined();
      expect(displayTrait!.symbol_kind).toBe('interface');
      
      // Should find struct
      const pointStruct = defs.find(d => d.name === 'Point');
      expect(pointStruct).toBeDefined();
      expect(pointStruct!.symbol_kind).toBe('struct');
      
      // Should find trait method
      const fmtMethod = defs.find(d => d.name === 'fmt');
      expect(fmtMethod).toBeDefined();
    }
  },
  
  {
    name: 'Module system with pub visibility',
    code: `mod utils {
    pub fn public_function() {
        private_function();
    }
    
    fn private_function() {
        println!("Private");
    }
}

use utils::public_function;

fn main() {
    public_function();
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find module
      const utilsMod = defs.find(d => d.name === 'utils');
      expect(utilsMod).toBeDefined();
      expect(utilsMod!.symbol_kind).toBe('module');
      
      // Should find both functions
      const publicFn = defs.find(d => d.name === 'public_function');
      expect(publicFn).toBeDefined();
      
      const privateFn = defs.find(d => d.name === 'private_function');
      expect(privateFn).toBeDefined();
    }
  },
  
  {
    name: 'Ownership and borrowing',
    code: `fn take_ownership(s: String) {
    println!("{}", s);
}

fn borrow_reference(s: &String) {
    println!("{}", s);
}

fn main() {
    let s1 = String::from("hello");
    let s2 = &s1;
    
    borrow_reference(&s1);
    take_ownership(s1);
    // s1 is no longer valid here
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find all functions and variables
      const takeOwnership = defs.find(d => d.name === 'take_ownership');
      expect(takeOwnership).toBeDefined();
      
      const s1Def = defs.find(d => d.name === 's1');
      expect(s1Def).toBeDefined();
      
      const s2Def = defs.find(d => d.name === 's2');
      expect(s2Def).toBeDefined();
    }
  },
  
  {
    name: 'Associated types and constants',
    code: `trait Container {
    type Item;
    const MAX_SIZE: usize;
    
    fn add(&mut self, item: Self::Item);
}

struct Stack<T> {
    items: Vec<T>,
}

impl<T> Container for Stack<T> {
    type Item = T;
    const MAX_SIZE: usize = 1000;
    
    fn add(&mut self, item: Self::Item) {
        self.items.push(item);
    }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find trait with associated type
      const containerTrait = defs.find(d => d.name === 'Container');
      expect(containerTrait).toBeDefined();
      
      // Should find associated type
      const itemType = defs.find(d => d.name === 'Item');
      expect(itemType).toBeDefined();
      
      // Should find associated constant
      const maxSize = defs.find(d => d.name === 'MAX_SIZE');
      expect(maxSize).toBeDefined();
    }
  },
  
  {
    name: 'Loop labels',
    code: `fn main() {
    'outer: loop {
        let mut x = 0;
        'inner: loop {
            x += 1;
            if x > 5 {
                break 'outer;
            }
            if x > 3 {
                continue 'inner;
            }
        }
    }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Should find loop labels
      const outerLabel = defs.find(d => d.name === "'outer");
      expect(outerLabel).toBeDefined();
      
      const innerLabel = defs.find(d => d.name === "'inner");
      expect(innerLabel).toBeDefined();
      
      // Should find references to labels in break/continue
      const refs = graph!.getNodes('reference');
      const outerRefs = refs.filter(r => r.name === "'outer");
      expect(outerRefs.length).toBeGreaterThan(0);
    }
  }
];

runLanguageSpecificTests('Rust', rustSpecificTests, () => 'rs');