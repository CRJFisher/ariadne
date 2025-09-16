import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { build_scope_tree } from "./src/scope_analysis/scope_tree/scope_tree";
import { FilePath } from "@ariadnejs/types";

const parser = new Parser();
parser.setLanguage(TypeScript.tsx as any);

const code = `
function parent() {
  function child1() {}
  function child2() {}
}
`;

const tree = parser.parse(code);
const file_path = "/test.ts" as FilePath;
const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

// Debug output
console.log("All scopes:");
Array.from(scope_tree.nodes.values()).forEach(scope => {
  console.log(`${scope.type}: ${"name" in scope ? scope.name : "unnamed"} [${scope.id}]`);
  console.log(`  parent: ${scope.parent_id || "none"}`);
  console.log(`  children: ${scope.child_ids.join(", ") || "none"}`);
});

const parent_scope = Array.from(scope_tree.nodes.values()).find(
  s => "name" in s && s.name === "parent"
);
const child1_scope = Array.from(scope_tree.nodes.values()).find(
  s => "name" in s && s.name === "child1"
);
const child2_scope = Array.from(scope_tree.nodes.values()).find(
  s => "name" in s && s.name === "child2"
);

console.log("\nChecking relationships:");
console.log("Parent scope ID:", parent_scope?.id);
console.log("Parent's children:", parent_scope?.child_ids);
console.log("Child1 ID:", child1_scope?.id);
console.log("Child1's parent:", child1_scope?.parent_id);
console.log("Child2 ID:", child2_scope?.id);
console.log("Child2's parent:", child2_scope?.parent_id);