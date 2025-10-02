import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import * as fs from "fs";

const parser = new Parser();
parser.setLanguage(Rust);

const sourceCode = fs.readFileSync("/tmp/test_trait_methods.rs", "utf8");
const tree = parser.parse(sourceCode);

function printTree(node: Parser.SyntaxNode, indent = 0): void {
  const spaces = "  ".repeat(indent);
  
  if (node.childCount === 0) {
    console.log(`${spaces}(${node.type} "${node.text.replace(/\n/g, "\\n").substring(0, 50)}")`);
  } else {
    console.log(`${spaces}(${node.type}`);
    for (let i = 0; i < node.childCount; i++) {
      printTree(node.child(i)!, indent + 1);
    }
    console.log(`${spaces})`);
  }
}

function findNodes(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  const results: Parser.SyntaxNode[] = [];
  if (node.type === type) results.push(node);
  for (let i = 0; i < node.childCount; i++) {
    results.push(...findNodes(node.child(i)!, type));
  }
  return results;
}

console.log("=== TRAIT ITEMS ===");
const traitItems = findNodes(tree.rootNode, "trait_item");
traitItems.forEach((trait, idx) => {
  console.log(`\n--- Trait ${idx + 1} ---`);
  printTree(trait, 0);
});

console.log("\n\n=== ENUM ITEMS ===");
const enumItems = findNodes(tree.rootNode, "enum_item");
enumItems.forEach((enumNode, idx) => {
  console.log(`\n--- Enum ${idx + 1} ---`);
  printTree(enumNode, 0);
});

console.log("\n\n=== GENERIC TYPE PARAMETERS ===");
const typeParams = findNodes(tree.rootNode, "type_parameters");
typeParams.forEach((param, idx) => {
  console.log(`\n--- Type Parameters ${idx + 1} ---`);
  printTree(param, 0);
});

console.log("\n\n=== FUNCTION SIGNATURE ITEMS (trait methods) ===");
const funcSigs = findNodes(tree.rootNode, "function_signature_item");
funcSigs.forEach((sig, idx) => {
  console.log(`\n--- Function Signature ${idx + 1} ---`);
  printTree(sig, 0);
});
