import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import * as fs from "fs";

const parser = new Parser();
parser.setLanguage(Rust);

const sourceCode = fs.readFileSync("/tmp/test_sample.rs", "utf8");
const tree = parser.parse(sourceCode);

// Function to print tree structure
function printTree(node: Parser.SyntaxNode, indent = 0): void {
  const spaces = "  ".repeat(indent);

  if (node.childCount === 0) {
    console.log(
      `${spaces}(${node.type} [${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}] "${node.text.replace(/\n/g, "\\n")}")`
    );
  } else {
    console.log(
      `${spaces}(${node.type} [${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}]`
    );

    for (let i = 0; i < node.childCount; i++) {
      printTree(node.child(i)!, indent + 1);
    }

    console.log(`${spaces})`);
  }
}

// Function to find nodes by type
function findNodes(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  const results: Parser.SyntaxNode[] = [];

  if (node.type === type) {
    results.push(node);
  }

  for (let i = 0; i < node.childCount; i++) {
    results.push(...findNodes(node.child(i)!, type));
  }

  return results;
}

// Focus on parameters specifically
console.log("=== Looking for parameters nodes ===");

const functionItems = findNodes(tree.rootNode, "function_item");
console.log(`\nFound ${functionItems.length} function_item nodes`);

functionItems.forEach((funcNode, idx) => {
  console.log(`\n--- Function ${idx + 1}: ${funcNode.text.split('\n')[0]} ---`);

  // Find parameters child
  const params = findNodes(funcNode, "parameters");
  console.log(`Found ${params.length} parameters nodes`);

  params.forEach(paramNode => {
    console.log("\nParameters node structure:");
    printTree(paramNode, 0);
  });
});

const implItems = findNodes(tree.rootNode, "impl_item");
console.log(`\n\n=== Found ${implItems.length} impl_item nodes ===`);

implItems.forEach((implNode, idx) => {
  console.log(`\n--- Impl block ${idx + 1} ---`);

  // Show the type field
  const typeNode = implNode.childForFieldName("type");
  console.log(`Type: ${typeNode?.text || 'N/A'}`);

  // Find methods in declaration_list
  const declList = implNode.childForFieldName("body");
  if (declList) {
    console.log(`\nDeclaration list structure:`);
    printTree(declList, 0);
  }
});

const traitItems = findNodes(tree.rootNode, "trait_item");
console.log(`\n\n=== Found ${traitItems.length} trait_item nodes ===`);

traitItems.forEach((traitNode, idx) => {
  console.log(`\n--- Trait ${idx + 1} ---`);

  // Find method signatures in declaration_list
  const declList = traitNode.childForFieldName("body");
  if (declList) {
    console.log(`\nDeclaration list structure:`);
    printTree(declList, 0);
  }
});
