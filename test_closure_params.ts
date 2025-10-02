import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";

const parser = new Parser();
parser.setLanguage(Rust);

const code = `
fn main() {
    let add = |x, y| x + y;
    let typed = |x: i32, y: i32| x + y;
    let simple_closure = |x| x * 2;
}
`;

const tree = parser.parse(code);

function findNodes(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  const results: Parser.SyntaxNode[] = [];
  if (node.type === type) results.push(node);
  for (let i = 0; i < node.childCount; i++) {
    results.push(...findNodes(node.child(i)!, type));
  }
  return results;
}

function printTree(node: Parser.SyntaxNode, indent = 0): void {
  const spaces = "  ".repeat(indent);
  if (node.childCount === 0) {
    console.log(spaces + "(" + node.type + ' "' + node.text + '")');
  } else {
    console.log(spaces + "(" + node.type);
    for (let i = 0; i < node.childCount; i++) {
      printTree(node.child(i)!, indent + 1);
    }
    console.log(spaces + ")");
  }
}

const closures = findNodes(tree.rootNode, "closure_expression");
console.log("=== CLOSURE PARAMETERS ===\n");
closures.forEach((closure, idx) => {
  console.log("Closure " + (idx + 1) + ":");
  printTree(closure, 0);
  console.log();
});
