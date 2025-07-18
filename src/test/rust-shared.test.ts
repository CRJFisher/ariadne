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
  },

  // Function metadata tests
  {
    name: 'Async Function Metadata',
    code: `async fn fetch_data(url: &str) -> Result<String, Error> {
    let response = client.get(url).send().await?;
    let body = response.text().await?;
    Ok(body)
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const funcDef = defs.find(d => d.name === 'fetch_data' && d.symbol_kind === 'function');
      expect(funcDef).toBeDefined();
      expect(funcDef!.metadata).toBeDefined();
      expect(funcDef!.metadata!.is_async).toBe(true);
      expect(funcDef!.metadata!.line_count).toBe(5);
      expect(funcDef!.metadata!.parameter_names).toEqual(['url']);
    }
  },

  {
    name: 'Test Function Detection',
    code: `#[test]
fn test_addition() {
    assert_eq!(add(2, 3), 5);
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_subtraction() {
        assert_eq!(subtract(5, 3), 2);
    }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      // Functions with #[test] attribute should be marked as test
      const testAddition = defs.find(d => d.name === 'test_addition');
      expect(testAddition).toBeDefined();
      expect(testAddition!.metadata!.is_test).toBe(true);
      
      const testSubtraction = defs.find(d => d.name === 'test_subtraction');
      expect(testSubtraction).toBeDefined();
      expect(testSubtraction!.metadata!.is_test).toBe(true);
    }
  },

  {
    name: 'Method Metadata in Impl Blocks',
    code: `struct UserService {
    api_url: String,
}

impl UserService {
    pub async fn get_user(&self, id: u64) -> Result<User, Error> {
        let url = format!("{}/users/{}", self.api_url, id);
        self.fetch(url).await
    }
    
    fn validate_id(&self, id: u64) -> bool {
        id > 0
    }
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const getUserMethod = defs.find(d => d.name === 'get_user');
      expect(getUserMethod).toBeDefined();
      expect(getUserMethod!.metadata).toBeDefined();
      expect(getUserMethod!.metadata!.is_async).toBe(true);
      expect(getUserMethod!.metadata!.class_name).toBe('UserService');
      expect(getUserMethod!.metadata!.parameter_names).toEqual(['&self', 'id']);
      expect(getUserMethod!.metadata!.is_private).toBe(false);
      
      const validateMethod = defs.find(d => d.name === 'validate_id');
      expect(validateMethod).toBeDefined();
      expect(validateMethod!.metadata).toBeDefined();
      expect(validateMethod!.metadata!.is_private).toBe(true); // No pub keyword
      expect(validateMethod!.metadata!.class_name).toBe('UserService');
    }
  },

  {
    name: 'Parameter Patterns',
    code: `fn process_data(
    simple: i32,
    mut mutable: String,
    (x, y): (f64, f64),
    Point { x: px, y: py }: Point,
) -> i32 {
    simple + px as i32 + py as i32
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const processData = defs.find(d => d.name === 'process_data');
      expect(processData).toBeDefined();
      // Parameter extraction for complex patterns may vary
      expect(processData!.metadata!.parameter_names!.length).toBeGreaterThan(0);
      expect(processData!.metadata!.parameter_names).toContain('simple');
      expect(processData!.metadata!.parameter_names).toContain('mut mutable');
    }
  },

  {
    name: 'Generic Function Metadata',
    code: `fn compare<T: PartialOrd>(a: T, b: T) -> bool {
    a < b
}

fn multiple_bounds<T: Clone + Debug, U: Display>(t: T, u: U) {
    println!("{:?} {}", t, u);
}`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const compare = defs.find(d => d.name === 'compare');
      expect(compare).toBeDefined();
      expect(compare!.metadata!.line_count).toBe(3);
      expect(compare!.metadata!.parameter_names).toEqual(['a', 'b']);
      
      const multipleBounds = defs.find(d => d.name === 'multiple_bounds');
      expect(multipleBounds).toBeDefined();
      expect(multipleBounds!.metadata!.parameter_names).toEqual(['t', 'u']);
    }
  }
];

runLanguageSpecificTests('Rust', rustSpecificTests, () => 'rs');