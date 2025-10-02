import Parser, { Query } from "tree-sitter";
import Rust from "tree-sitter-rust";

const parser = new Parser();
parser.setLanguage(Rust);

// Test all patterns that should match
const testCases = [
  {
    name: "Function parameters",
    code: "fn add(x: i32, y: i32) -> i32 { x + y }",
    query: "(parameter (identifier) @definition.parameter)",
    expectedMatches: 2,
    expectedCaptures: ["x", "y"]
  },
  {
    name: "Self parameters",
    code: "impl Point { fn distance(&self, other: &Point) -> f64 { 0.0 } }",
    query: "(self_parameter) @definition.parameter.self",
    expectedMatches: 1,
    expectedCaptures: ["&self"]
  },
  {
    name: "Enum variants",
    code: "enum Direction { North, South, East, West }",
    query: "(enum_variant (identifier) @definition.enum_member)",
    expectedMatches: 4,
    expectedCaptures: ["North", "South", "East", "West"]
  },
  {
    name: "Trait method signatures",
    code: "trait Drawable { fn draw(&self); fn color(&self) -> String; }",
    query: "(trait_item body: (declaration_list (function_signature_item (identifier) @definition.interface.method)))",
    expectedMatches: 2,
    expectedCaptures: ["draw", "color"]
  },
  {
    name: "Trait default methods",
    code: "trait Display { fn fmt(&self) -> String { String::new() } }",
    query: "(trait_item body: (declaration_list (function_item (identifier) @definition.method.default)))",
    expectedMatches: 1,
    expectedCaptures: ["fmt"]
  },
  {
    name: "Impl block methods",
    code: "impl Point { fn new(x: i32) -> Self { Point { x } } fn distance(&self) -> f64 { 0.0 } }",
    query: "(impl_item type: (_) body: (declaration_list (function_item (identifier) @definition.method)))",
    expectedMatches: 2,
    expectedCaptures: ["new", "distance"]
  },
  {
    name: "Generic functions",
    code: "fn process<T>(value: T) -> T { value }",
    query: "(function_item (identifier) @definition.function.generic type_parameters: (type_parameters))",
    expectedMatches: 1,
    expectedCaptures: ["process"]
  }
];

console.log("=== RUST QUERY PATTERN VERIFICATION ===\n");

let allPassed = true;

testCases.forEach((testCase, idx) => {
  console.log(`Test ${idx + 1}: ${testCase.name}`);
  console.log(`Code: ${testCase.code}`);
  console.log(`Query: ${testCase.query}`);
  
  const tree = parser.parse(testCase.code);
  
  try {
    const query = new Query(Rust, testCase.query);
    const matches = query.matches(tree.rootNode);
    
    const captures = matches.flatMap(m => m.captures.map(c => c.node.text));
    
    console.log(`  Expected matches: ${testCase.expectedMatches}, Got: ${matches.length}`);
    console.log(`  Expected captures: [${testCase.expectedCaptures.join(", ")}]`);
    console.log(`  Actual captures:   [${captures.join(", ")}]`);
    
    const matchCountOk = matches.length === testCase.expectedMatches;
    const capturesOk = JSON.stringify(captures.sort()) === JSON.stringify(testCase.expectedCaptures.sort());
    
    if (matchCountOk && capturesOk) {
      console.log("  ✅ PASS\n");
    } else {
      console.log("  ❌ FAIL");
      if (!matchCountOk) console.log(`     Match count mismatch`);
      if (!capturesOk) console.log(`     Capture values mismatch`);
      console.log();
      allPassed = false;
    }
  } catch (err: any) {
    console.log(`  ❌ QUERY ERROR: ${err.message}\n`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log("✅ All query patterns verified successfully!");
} else {
  console.log("❌ Some query patterns failed verification");
  process.exit(1);
}
