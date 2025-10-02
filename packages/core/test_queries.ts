import Parser, { Query } from "tree-sitter";
import Rust from "tree-sitter-rust";

const parser = new Parser();
parser.setLanguage(Rust);

const sourceCode = "fn add(x: i32, y: i32) -> i32 { x + y }\nstruct Point { x: i32, y: i32 }\nimpl Point {\n  fn new(x: i32, y: i32) -> Self { Point { x, y } }\n  fn distance(&self, other: &Point) -> f64 { 0.0 }\n}\ntrait Drawable {\n  fn draw(&self);\n  fn color(&self) -> String;\n}";

const tree = parser.parse(sourceCode);

const paramQuery = new Query(Rust, "(parameter (identifier) @definition.parameter)");
console.log("Parameter matches:", paramQuery.matches(tree.rootNode).length);
paramQuery.matches(tree.rootNode).forEach((m: any) => m.captures.forEach((c: any) => console.log("  ", c.node.text)));

const selfQuery = new Query(Rust, "(self_parameter) @definition.parameter.self");
console.log("\nSelf parameter matches:", selfQuery.matches(tree.rootNode).length);
selfQuery.matches(tree.rootNode).forEach((m: any) => m.captures.forEach((c: any) => console.log("  ", c.node.text)));

const methodQuery = new Query(Rust, "(impl_item type: (_) body: (declaration_list (function_item (identifier) @definition.method)))");
console.log("\nImpl method matches:", methodQuery.matches(tree.rootNode).length);
methodQuery.matches(tree.rootNode).forEach((m: any) => m.captures.forEach((c: any) => console.log("  ", c.node.text)));

const traitMethodQuery = new Query(Rust, "(trait_item body: (declaration_list (function_signature_item (identifier) @definition.interface.method)))");
console.log("\nTrait method matches:", traitMethodQuery.matches(tree.rootNode).length);
traitMethodQuery.matches(tree.rootNode).forEach((m: any) => m.captures.forEach((c: any) => console.log("  ", c.node.text)));
